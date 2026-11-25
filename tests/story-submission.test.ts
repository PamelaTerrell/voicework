import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/story-submission";
import { request, response } from "./helpers";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

const story = {
  story_title: "A memory",
  story_category: "Intuition",
  story_body: "A synthetic test story.",
  permission_granted: true,
  name_preference: "First name only",
  submitter_name: " Fictional ",
  submitter_email: "local@example.test",
  website: "",
};

async function submit(
  body: string,
  headers: Record<string, string> = {},
  method = "POST",
) {
  const stream = Readable.from([Buffer.from(body)]);
  const req = Object.assign(stream, request({
    method,
    headers: { "content-type": "application/json", ...headers },
  }), { socket: { remoteAddress: "127.0.0.1" } });
  const { res, result } = response();
  await handler(req, res);
  return result;
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
  vi.stubEnv("STORY_RATE_LIMIT_SECRET", "only-for-tests-at-least-32-bytes");
  vi.stubEnv("VERCEL", "1");
  rpc.mockResolvedValue({ data: true, error: null });
});
afterEach(() => vi.unstubAllEnvs());

const vercelIp = { "x-vercel-forwarded-for": "192.0.2.1" };

describe("story submission endpoint", () => {
  it("accepts the existing consent and identity options without returning private data", async () => {
    const result = await submit(JSON.stringify(story), vercelIp);
    expect(result.statusCode).toBe(201);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.body).toEqual({ message: expect.stringContaining("received") });
    const { website, ...fields } = story;
    expect(website).toBe("");
    expect(rpc).toHaveBeenCalledWith("submit_story_with_rate_limit", {
      p_bucket: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_story: { ...fields, submitter_name: "Fictional" },
    });
  });

  it.each([
    { permission_granted: "true" },
    { permission_granted: undefined },
    { story_body: "  " },
    { story_body: "x".repeat(12001) },
    { story_title: "x".repeat(201) },
    { name_preference: "Publish everything" },
    { story_category: ["Intuition"] },
    { submitter_name: "x".repeat(121) },
    { submitter_email: "not an email" },
    { status: "approved" },
    { website: "spam" },
  ])("rejects malformed or unwanted fields before calling the database", async (overrides) => {
    expect((await submit(JSON.stringify({ ...story, ...overrides }), vercelIp)).statusCode).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("bounds the streamed request and rejects invalid JSON", async () => {
    expect((await submit(" ".repeat(100000), vercelIp)).statusCode).toBe(413);
    expect((await submit("{", vercelIp)).statusCode).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts only same-site JSON POSTs and fails closed without the Vercel IP", async () => {
    const body = JSON.stringify(story);
    expect((await submit(body, vercelIp, "GET")).statusCode).toBe(405);
    expect((await submit(body, { "content-type": "text/plain" })).statusCode).toBe(415);
    expect((await submit(body, { "sec-fetch-site": "cross-site" })).statusCode).toBe(403);
    expect((await submit(body, { "x-forwarded-for": "192.0.2.1" })).statusCode).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a retry hint after the database refuses the rate bucket", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await submit(JSON.stringify(story), vercelIp);
    expect(result.statusCode).toBe(429);
    expect(result.headers.get("retry-after")).toBe("3600");
  });

  it("returns generic failures when the database is unavailable", async () => {
    rpc.mockRejectedValue(new Error("internal fixture"));
    const result = await submit(JSON.stringify(story), vercelIp);
    expect(result.statusCode).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain("internal fixture");
  });
});
