import type { VercelRequest, VercelResponse } from "@vercel/node";
import { vi } from "vitest";

export function request(
  overrides: Partial<VercelRequest> = {}
): VercelRequest {
  return {
    method: "GET",
    headers: {},
    query: {},
    cookies: {},
    body: undefined,
    ...overrides,
  } as VercelRequest;
}

export function response() {
  const headers = new Map<string, string>();
  const result = {
    statusCode: 200,
    body: undefined as unknown,
  } as {
    statusCode: number;
    body: unknown;
    headers: Map<string, string>;
  };
  Object.defineProperty(result, "headers", { value: headers, enumerable: false });

  const res = {
    setHeader: vi.fn((name: string, value: number | string | readonly string[]) => {
      headers.set(name.toLowerCase(), Array.isArray(value) ? value.join(", ") : String(value));
      return res;
    }),
    getHeader: vi.fn((name: string) => headers.get(name.toLowerCase())),
    status: vi.fn((statusCode: number) => {
      result.statusCode = statusCode;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      result.body = body;
      return res;
    }),
    send: vi.fn((body: unknown) => {
      result.body = body;
      return res;
    }),
    end: vi.fn(() => res),
  } as unknown as VercelResponse;

  return { res, result };
}

export function authError(message = "Invalid token") {
  return Object.assign(new Error(message), { status: 401 });
}
