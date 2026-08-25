import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./helpers.js";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("stripe", () => ({
  default: class StripeMock {},
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser } }),
}));

import { requireUser } from "../api/_lib.js";

beforeEach(() => {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "user-current", email: "trusted" } },
    error: null,
  });
});

describe("Supabase bearer authentication", () => {
  it("rejects a missing bearer token without calling Supabase", async () => {
    await expect(requireUser(request())).rejects.toMatchObject({ status: 401 });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it.each([
    "Basic unsupported",
    "Bearer",
    "bearer test-placeholder",
  ])("rejects malformed authorization %j", async (authorization) => {
    await expect(
      requireUser(request({ headers: { authorization } }))
    ).rejects.toMatchObject({ status: 401 });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("rejects invalid or expired Supabase authentication", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("expired"),
    });
    await expect(
      requireUser(
        request({ headers: { authorization: "Bearer test-placeholder" } })
      )
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns only the user supplied by trusted Supabase verification", async () => {
    const user = await requireUser(
      request({ headers: { authorization: "Bearer test-placeholder" } })
    );
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(user).toEqual({ id: "user-current", email: "trusted" });
  });
});
