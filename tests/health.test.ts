import type { VercelResponse } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import health from "../api/health.js";
import { request } from "./helpers.js";

const REQUIRED_NAMES = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID_SUBSCRIPTION",
  "SITE_URL",
] as const;

const TRACKED_NAMES = [...REQUIRED_NAMES, "STRIPE_PRICE_ID_ONE_TIME"] as const;

const originalValues = new Map<string, string | undefined>();

function response() {
  const result = {
    statusCode: 200,
    body: undefined as unknown,
    headers: new Map<string, string>(),
  };

  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      result.headers.set(name.toLowerCase(), value);
      return res;
    }),
    status: vi.fn((statusCode: number) => {
      result.statusCode = statusCode;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      result.body = body;
      return res;
    }),
  } as unknown as VercelResponse;

  return { res, result };
}

function setAllRequired() {
  for (const name of REQUIRED_NAMES) {
    process.env[name] = `configured-test-placeholder-${name.toLowerCase()}`;
  }
}

beforeEach(() => {
  originalValues.clear();
  for (const name of TRACKED_NAMES) originalValues.set(name, process.env[name]);
  setAllRequired();
});

afterEach(() => {
  for (const [name, value] of originalValues) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("public health endpoint", () => {
  it("returns only healthy state when all required configuration is present", () => {
    delete process.env.STRIPE_PRICE_ID_ONE_TIME;
    const { res, result } = response();
    health(request({ method: "GET" }), res);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  it("returns the same generic unavailable state for one or many missing values", () => {
    delete process.env.SITE_URL;
    let output = response();
    health(request({ method: "GET" }), output.res);
    expect(output.result.statusCode).toBe(503);
    expect(output.result.body).toEqual({ ok: false });

    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    output = response();
    health(request({ method: "GET" }), output.res);
    expect(output.result.statusCode).toBe(503);
    expect(output.result.body).toEqual({ ok: false });
  });

  it("does not reveal configuration names or configured values", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { res, result } = response();
    health(request({ method: "GET" }), res);

    const serialized = JSON.stringify(result.body);
    for (const name of TRACKED_NAMES) expect(serialized).not.toContain(name);
    expect(serialized).not.toContain("configured-test-placeholder");
    expect(Object.keys(result.body as object)).toEqual(["ok"]);
  });

  it("rejects unsupported methods generically", () => {
    const { res, result } = response();
    health(request({ method: "POST" }), res);
    expect(result.statusCode).toBe(405);
    expect(result.body).toEqual({ ok: false });
  });

  it.each<[string, string | undefined, number]>([
    ["healthy", undefined, 200],
    ["unavailable", "SITE_URL", 503],
    ["unsupported", undefined, 405],
  ])("sets no-store for %s responses", (_label, missing, expectedStatus) => {
    if (missing) delete process.env[missing];
    const { res, result } = response();
    health(request({ method: expectedStatus === 405 ? "PATCH" : "GET" }), res);
    expect(result.statusCode).toBe(expectedStatus);
    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  it("does not mutate environment state", () => {
    const before = REQUIRED_NAMES.map((name) => [name, process.env[name]]);
    const { res } = response();
    health(request({ method: "GET" }), res);
    expect(REQUIRED_NAMES.map((name) => [name, process.env[name]])).toEqual(before);
  });
});
