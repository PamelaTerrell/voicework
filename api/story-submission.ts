import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STORY_CATEGORIES, STORY_LIMITS, STORY_NAME_PREFERENCES } from "../src/lib/storySubmissionFields.js";
import { setApiResponseHeaders } from "./_responseHeaders.js";

export const config = { api: { bodyParser: false } };

const MAX_REQUEST_BYTES = 96 * 1024;
const UNAVAILABLE = "Your submission could not be sent right now. Please try again.";
const ACCEPTED = "Thank you for trusting Stabile USA with your story. Your submission was received.";
const FIELDS = new Set([
  "story_title", "story_category", "story_body", "permission_granted",
  "name_preference", "submitter_name", "submitter_email", "website",
]);

function text(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > maxLength || value.includes("\0")) {
    return undefined;
  }
  return value.trim() || null;
}

async function readBody(req: VercelRequest) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_REQUEST_BYTES) {
      req.resume();
      return { tooLarge: true } as const;
    }
    chunks.push(buffer);
  }

  const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  return { tooLarge: false, body } as const;
}

function clientAddress(req: VercelRequest) {
  const address = process.env.VERCEL === "1"
    ? req.headers["x-vercel-forwarded-for"]
    : req.socket.remoteAddress;

  if (typeof address !== "string" || !isIP(address)) return null;
  if (address.startsWith("::ffff:") && isIP(address.slice(7)) === 4) return address.slice(7);
  return isIP(address) === 6 ? new URL(`http://[${address}]`).hostname : address;
}

type Story = {
  story_title: string | null;
  story_category: string;
  story_body: string;
  permission_granted: true;
  name_preference: string;
  submitter_name: string | null;
  submitter_email: string | null;
};

async function saveStory(bucket: string, story: Story) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.rpc("submit_story_with_rate_limit", {
    p_bucket: bucket,
    p_story: story,
  });
  return !error && typeof data === "boolean" ? data : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiResponseHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Use POST to submit a story." });
  }
  if (req.headers["sec-fetch-site"] === "cross-site") {
    return res.status(403).json({ message: "Open the Stabile USA form to submit your story." });
  }
  if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return res.status(415).json({ message: "Use the Stabile USA form to submit your story." });
  }
  const tooLarge = () => res.status(413).json({ message: "Your submission is too large." });
  if (Number(req.headers["content-length"]) > MAX_REQUEST_BYTES) return tooLarge();

  let parsed;
  try {
    parsed = await readBody(req);
  } catch {
    return res.status(400).json({ message: "We couldn't read your submission. Please check the form and try again." });
  }
  if (parsed.tooLarge) return tooLarge();
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((field) => !FIELDS.has(field))) {
    return res.status(400).json({ message: "Your submission contains invalid fields." });
  }

  const fields = body as Record<string, unknown>;
  if (fields.website !== undefined && fields.website !== "") {
    return res.status(400).json({ message: "We couldn't accept this submission. Please check the form and try again." });
  }
  if (fields.permission_granted !== true) {
    return res.status(400).json({ message: "Please review and check the publishing permission before submitting." });
  }

  const title = text(fields.story_title, STORY_LIMITS.title);
  const story = text(fields.story_body, STORY_LIMITS.body);
  const name = text(fields.submitter_name, STORY_LIMITS.name);
  const email = text(fields.submitter_email, STORY_LIMITS.email);
  const category = fields.story_category;
  const preference = fields.name_preference;
  if (!story || title === undefined || name === undefined || email === undefined ||
      (email !== null && !/^[^\s@]+@[^\s@]+$/.test(email)) ||
      typeof category !== "string" || !STORY_CATEGORIES.some((value) => value === category) ||
      typeof preference !== "string" || !STORY_NAME_PREFERENCES.some((value) => value === preference)) {
    return res.status(400).json({ message: "Check your story, category, name preference, and optional contact details for invalid or overly long entries." });
  }

  const secret = process.env.STORY_RATE_LIMIT_SECRET;
  const address = clientAddress(req);
  if (!address || !secret || Buffer.byteLength(secret) < 32) {
    return res.status(503).json({ message: UNAVAILABLE });
  }

  try {
    const bucket = createHmac("sha256", secret).update(address).digest("hex");
    const result = await saveStory(bucket, {
      story_title: title,
      story_category: category,
      story_body: story,
      permission_granted: true,
      name_preference: preference,
      submitter_name: name,
      submitter_email: email,
    });
    if (result === true) return res.status(201).json({ message: ACCEPTED });
    if (result === false) {
      res.setHeader("Retry-After", "3600");
      return res.status(429).json({ message: "Too many stories have been submitted from this connection. Please try again in an hour." });
    }
  } catch {
    // Keep story text, contact details, and database errors out of application logs.
  }
  return res.status(503).json({ message: UNAVAILABLE });
}
