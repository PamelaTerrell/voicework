import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  "supabase/migrations/20260825170000_revoke_profiles_browser_access.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const normalizedMigration = migration
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".js", ".jsx"].includes(extname(entry.name))
      ? [path]
      : [];
  });
}

const directProfileAccess = /\.from\s*\(\s*["'`]profiles["'`]\s*\)/;
const quotedProfileLiteral = /(["'`])profiles\1/;

function browserProfileReference(source: string) {
  // Conservative static guard only: regex cannot resolve dynamically built
  // table names, variables through data flow, or wrapper/helper abstractions.
  return directProfileAccess.test(source) || quotedProfileLiteral.test(source);
}

describe("profiles browser-access migration", () => {
  it("contains only the approved transactional profile permission changes", () => {
    expect(normalizedMigration).toBe(
      [
        "begin;",
        "alter table public.profiles enable row level security;",
        "revoke all privileges on table public.profiles from anon;",
        "revoke all privileges on table public.profiles from authenticated;",
        "drop policy if exists profiles_select_own on public.profiles;",
        "drop policy if exists profiles_update_own on public.profiles;",
        "commit;",
      ].join(" "),
    );
  });

  it("drops exactly the two obsolete policies and leaves service_role untouched", () => {
    const droppedPolicies = [
      ...normalizedMigration.matchAll(
        /drop policy if exists ([a-z0-9_]+) on public\.profiles;/g,
      ),
    ].map((match) => match[1]);

    expect(droppedPolicies).toEqual([
      "profiles_select_own",
      "profiles_update_own",
    ]);
    expect(normalizedMigration).not.toContain("service_role");
  });

  it("contains no data-changing, destructive, unrelated-table, or storage SQL", () => {
    for (const forbiddenStatement of [
      /\bdrop\s+table\b/,
      /\btruncate\b/,
      /\bdelete\b/,
      /\bupdate\b/,
      /\binsert\b/,
      /\bdrop\s+(?:column|schema)\b/,
      /\balter\s+(?:column|schema)\b/,
    ]) {
      expect(normalizedMigration).not.toMatch(forbiddenStatement);
    }

    for (const unrelatedTarget of [
      "entitlements",
      "episodes",
      "memberships",
      "story_submissions",
      "storage.objects",
      "storage.buckets",
    ]) {
      expect(normalizedMigration).not.toContain(unrelatedTarget);
    }
  });

  it("confirms browser source does not access the profiles table directly", () => {
    const offenders = sourceFiles(resolve("src")).filter((path) =>
      browserProfileReference(readFileSync(path, "utf8")),
    );

    expect(offenders).toEqual([]);
  });

  it.each([
    ['supabase.from("profiles")'],
    ["supabase.from('profiles')"],
    ["supabase.from(`profiles`)"],
    ['supabase.from ("profiles")'],
    ['supabase.from\n(\n  "profiles"\n)'],
    ['supabase.from \n ( \n "profiles" \n )'],
  ])("detects direct browser profile access in %j", (fixture) => {
    expect(directProfileAccess.test(fixture)).toBe(true);
  });

  it.each([
    ['const table = "profiles";'],
    ["const table = 'profiles';"],
    ["const table = `profiles`;"],
  ])("conservatively detects a quoted profile table literal in %j", (fixture) => {
    expect(quotedProfileLiteral.test(fixture)).toBe(true);
  });
});
