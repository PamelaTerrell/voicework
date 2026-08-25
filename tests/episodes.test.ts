import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EPISODE_FILE_MAP, isApprovedEpisodeId } from "../api/_episodes.js";

const expectedIds = [
  "versions-ep5",
  "conversation-ep2",
  "replays-ep1",
  "say-sorry-ep3",
  "resentment-ep4",
  "im-fine-ep6",
  "lonely-night-ep7",
  "lonely-night-part2-ep8",
  "had-everything-part1-ep9",
  "had-everything-part2-ep10",
  "never-made-you-guess-ep11",
  "the-hardest-people-ep12",
  "life-you-didnt-get-ep13",
  "toast-ep14",
  "love-him-anyway-15",
];

describe("server episode catalog", () => {
  it("accepts every canonical ID including the historical episode 15 ID", () => {
    expect(Object.keys(EPISODE_FILE_MAP).sort()).toEqual(expectedIds.sort());
    for (const id of expectedIds) expect(isApprovedEpisodeId(id)).toBe(true);
    expect(isApprovedEpisodeId("love-him-anyway-15")).toBe(true);
  });

  it.each([undefined, null, "", "unknown-ep99", "../full.mp3", ["replays-ep1"]])(
    "rejects unsupported value %j",
    (value) => expect(isApprovedEpisodeId(value)).toBe(false)
  );

  it("never maps an approved preview to its protected full object", () => {
    for (const entry of Object.values(EPISODE_FILE_MAP)) {
      if (entry.preview) expect(entry.preview).not.toBe(entry.full);
    }
  });

  it("preserves unavailable previews and the single free-full exception", () => {
    expect(EPISODE_FILE_MAP["conversation-ep2"].preview).toBeNull();
    expect(EPISODE_FILE_MAP["im-fine-ep6"].preview).toBeNull();

    const source = readFileSync(resolve("api/signed-audio.ts"), "utf8");
    expect(source).toContain('new Set(["say-sorry-ep3"])');
    expect(source.match(/FREE_EPISODE_IDS/g)).toHaveLength(2);
  });

  it("is imported only from server API modules", () => {
    const browserFiles = [
      "src/pages/Home.tsx",
      "src/pages/Listen.tsx",
      "src/pages/Members.tsx",
      "src/pages/Thanks.tsx",
      "src/pages/Join.tsx",
    ];

    for (const file of browserFiles) {
      expect(readFileSync(resolve(file), "utf8")).not.toContain("_episodes");
    }
  });
});
