import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  "supabase/migrations/20260826120000_restrict_browser_table_permissions.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const normalizedMigration = migration
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .trim()
  .toLowerCase();

const entitlementColumns = [
  "id",
  "user_id",
  "episode_id",
  "source",
  "created_at",
] as const;

const storyColumns = [
  "id",
  "created_at",
  "story_title",
  "story_category",
  "story_body",
  "permission_granted",
  "name_preference",
  "submitter_name",
  "submitter_email",
  "status",
] as const;

const publicStoryColumns = [
  "story_title",
  "story_category",
  "story_body",
  "permission_granted",
  "name_preference",
  "submitter_name",
  "submitter_email",
] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".js", ".jsx"].includes(extname(entry.name))
      ? [path]
      : [];
  });
}

function columnList(values: readonly string[]) {
  return values.join(", ");
}

describe("Supabase browser table permissions migration", () => {
  it("contains the complete intended transactional SQL contract", () => {
    expect(normalizedMigration).toBe(
      [
        "begin;",
        "alter table public.entitlements enable row level security;",
        "revoke all privileges on table public.entitlements from anon;",
        "revoke all privileges on table public.entitlements from authenticated;",
        `revoke all privileges (${columnList(entitlementColumns)}) on table public.entitlements from anon;`,
        `revoke all privileges (${columnList(entitlementColumns)}) on table public.entitlements from authenticated;`,
        "drop policy if exists entitlements_select_own on public.entitlements;",
        "alter table public.story_submissions enable row level security;",
        "revoke all privileges on table public.story_submissions from anon;",
        "revoke all privileges on table public.story_submissions from authenticated;",
        `revoke all privileges (${columnList(storyColumns)}) on table public.story_submissions from anon;`,
        `revoke all privileges (${columnList(storyColumns)}) on table public.story_submissions from authenticated;`,
        `grant insert (${columnList(publicStoryColumns)}) on table public.story_submissions to anon, authenticated;`,
        'drop policy if exists "anyone can submit a story" on public.story_submissions;',
        'create policy "anyone can submit a story" on public.story_submissions as permissive for insert to anon, authenticated with check (permission_granted = true and status = \'new\');',
        "commit;",
      ].join(" "),
    );
  });

  it("enables RLS and revokes table and column privileges from both browser roles", () => {
    for (const table of ["entitlements", "story_submissions"]) {
      expect(normalizedMigration).toContain(
        `alter table public.${table} enable row level security;`,
      );
      for (const role of ["anon", "authenticated"]) {
        expect(normalizedMigration).toContain(
          `revoke all privileges on table public.${table} from ${role};`,
        );
      }
    }

    for (const role of ["anon", "authenticated"]) {
      expect(normalizedMigration).toContain(
        `revoke all privileges (${columnList(entitlementColumns)}) on table public.entitlements from ${role};`,
      );
      expect(normalizedMigration).toContain(
        `revoke all privileges (${columnList(storyColumns)}) on table public.story_submissions from ${role};`,
      );
    }
  });

  it("removes entitlement browser access without creating a replacement", () => {
    expect(normalizedMigration).toContain(
      "drop policy if exists entitlements_select_own on public.entitlements;",
    );
    expect(normalizedMigration).not.toMatch(
      /(?:grant|create policy)[^;]*public\.entitlements/,
    );
  });

  it("grants only the seven public story fields to both submission roles", () => {
    const grants = normalizedMigration.match(/grant\s+[^;]+;/g) ?? [];
    expect(grants).toEqual([
      `grant insert (${columnList(publicStoryColumns)}) on table public.story_submissions to anon, authenticated;`,
    ]);

    for (const internalColumn of ["id", "created_at", "status"]) {
      expect(grants[0]).not.toMatch(
        new RegExp(`\\b${internalColumn}\\b`),
      );
    }
  });

  it("allows anonymous and authenticated insert only with consent and a default new status", () => {
    // Product contract: signed-out visitors intentionally submit through anon.
    expect(normalizedMigration).toContain(
      'create policy "anyone can submit a story" on public.story_submissions as permissive for insert to anon, authenticated',
    );
    expect(normalizedMigration).toContain(
      "with check (permission_granted = true and status = 'new');",
    );
  });

  it("contains no browser read, mutation, ownership, or management grants", () => {
    const grants = normalizedMigration.match(/grant\s+[^;]+;/g) ?? [];
    expect(grants).toHaveLength(1);
    expect(grants[0]).not.toMatch(
      /\b(select|update|delete|truncate|references|trigger)\b/,
    );
    expect(normalizedMigration).not.toContain("service_role");
  });

  it("contains no data-changing SQL or unrelated database objects", () => {
    for (const dataStatement of [
      /\binsert\s+into\b/,
      /\bupdate\s+[^;]+\s+set\b/,
      /\bdelete\s+from\b/,
      /\btruncate\s+(?:table\s+)?public\./,
    ]) {
      expect(normalizedMigration).not.toMatch(dataStatement);
    }

    for (const unrelatedObject of [
      "public.profiles",
      "public.episodes",
      "storage.",
      " function ",
      " do $$",
    ]) {
      expect(normalizedMigration).not.toContain(unrelatedObject);
    }
  });
});

describe("browser source contract", () => {
  const browserSources = sourceFiles(resolve("src"));

  it("contains no direct entitlement table access", () => {
    const directEntitlementAccess =
      /\.from\s*\(\s*["'`]entitlements["'`]\s*\)/;
    const offenders = browserSources.filter((path) =>
      directEntitlementAccess.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("submits exactly the seven approved public story fields", () => {
    const homeSource = readFileSync(resolve("src/pages/Home.tsx"), "utf8");
    const insert = homeSource.match(
      /\.from\s*\(\s*["'`]story_submissions["'`]\s*\)\s*\.insert\s*\(\s*\{([\s\S]*?)\}\s*\)/,
    );

    expect(insert).not.toBeNull();
    const submittedColumns = [
      ...(insert?.[1].matchAll(/^\s*([a-z_]+)\s*:/gm) ?? []),
    ].map((match) => match[1]);
    expect(submittedColumns).toEqual(publicStoryColumns);
    expect(submittedColumns).not.toContain("id");
    expect(submittedColumns).not.toContain("created_at");
    expect(submittedColumns).not.toContain("status");
  });

  it("does not request returned rows or depend on browser SELECT permission", () => {
    const homeSource = readFileSync(resolve("src/pages/Home.tsx"), "utf8");
    const storyInsert = homeSource.match(
      /\.from\s*\(\s*["'`]story_submissions["'`]\s*\)([\s\S]*?);/,
    )?.[1];

    expect(storyInsert).toBeDefined();
    expect(storyInsert).toContain(".insert(");
    expect(storyInsert).not.toContain(".select(");
    expect(homeSource).toContain("const { error } = await supabase");
  });
});
