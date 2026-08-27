import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  attemptAudioPlay,
  createInitialPlaybackState,
  createPlaybackRequestManager,
  playbackReducer,
  playerScrollBehavior,
} from "../src/lib/memberPlayback.js";

describe("member playback state", () => {
  it("moves through idle, loading, ready, playing, and error", () => {
    const idle = createInitialPlaybackState("episode-a");
    const loading = playbackReducer(idle, {
      type: "loading",
      episodeId: "episode-a",
      requestId: 1,
    });
    const ready = playbackReducer(loading, {
      type: "ready",
      episodeId: "episode-a",
      requestId: 1,
      signedUrl: "signed-a",
    });
    const playing = playbackReducer(ready, {
      type: "playing",
      episodeId: "episode-a",
      requestId: 1,
    });
    const error = playbackReducer(playing, {
      type: "error",
      episodeId: "episode-a",
      requestId: 1,
      signedUrl: "signed-a",
      message: "Unable to play.",
    });

    expect(idle.phase).toBe("idle");
    expect(loading.phase).toBe("loading");
    expect(ready).toMatchObject({
      phase: "ready",
      episodeId: "episode-a",
      signedUrl: "signed-a",
    });
    expect(playing.phase).toBe("playing");
    expect(error).toMatchObject({
      phase: "error",
      signedUrl: "signed-a",
      message: "Unable to play.",
    });
  });

  it("suppresses stale success and error updates", () => {
    const current = playbackReducer(createInitialPlaybackState("episode-b"), {
      type: "loading",
      episodeId: "episode-b",
      requestId: 2,
    });
    const staleSuccess = playbackReducer(current, {
      type: "ready",
      episodeId: "episode-a",
      requestId: 1,
      signedUrl: "stale-secret-url",
    });
    const staleError = playbackReducer(current, {
      type: "error",
      episodeId: "episode-a",
      requestId: 1,
      message: "stale error",
    });

    expect(staleSuccess).toBe(current);
    expect(staleError).toBe(current);
    expect(staleSuccess.signedUrl).toBeNull();
  });

  it("starts a clean loading state when retrying an error", () => {
    const loading = playbackReducer(createInitialPlaybackState("episode-a"), {
      type: "loading",
      episodeId: "episode-a",
      requestId: 1,
    });
    const error = playbackReducer(loading, {
      type: "error",
      episodeId: "episode-a",
      requestId: 1,
      message: "Unable to open.",
    });
    const retrying = playbackReducer(error, {
      type: "loading",
      episodeId: "episode-a",
      requestId: 2,
    });

    expect(retrying).toEqual({
      phase: "loading",
      episodeId: "episode-a",
      requestId: 2,
      signedUrl: null,
      message: "",
    });
  });
});

describe("playback request ownership", () => {
  it("uses increasing IDs and aborts the previous request on reselection", () => {
    const manager = createPlaybackRequestManager();
    const first = manager.begin();
    const second = manager.begin();

    expect(second.requestId).toBeGreaterThan(first.requestId);
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    expect(manager.isCurrent(first.requestId)).toBe(false);
    expect(manager.isCurrent(second.requestId)).toBe(true);
  });

  it("suppresses stale finally cleanup", () => {
    const manager = createPlaybackRequestManager();
    const first = manager.begin();
    const second = manager.begin();

    expect(manager.finish(first.requestId)).toBe(false);
    expect(manager.isCurrent(second.requestId)).toBe(true);
    expect(manager.finish(second.requestId)).toBe(true);
    expect(manager.isCurrent(second.requestId)).toBe(false);
  });

  it("aborts the current request for unmount cleanup", () => {
    const manager = createPlaybackRequestManager();
    const request = manager.begin();
    manager.abortCurrent();

    expect(request.signal.aborted).toBe(true);
    expect(manager.isCurrent(request.requestId)).toBe(false);
  });
});

describe("player navigation and user-initiated playback", () => {
  it("scrolls only in stacked layouts and respects reduced motion", () => {
    expect(playerScrollBehavior(false, false)).toBeNull();
    expect(playerScrollBehavior(false, true)).toBeNull();
    expect(playerScrollBehavior(true, false)).toBe("smooth");
    expect(playerScrollBehavior(true, true)).toBe("auto");
  });

  it("reports a rejected play promise without claiming success", async () => {
    const play = vi.fn().mockRejectedValue(new Error("blocked"));
    await expect(attemptAudioPlay({ play })).resolves.toBe(false);
    expect(play).toHaveBeenCalledOnce();
  });

  it("reports successful playback only after play resolves", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    await expect(attemptAudioPlay({ play })).resolves.toBe(true);
    expect(play).toHaveBeenCalledOnce();
  });
});

describe("Members page playback integration", () => {
  const source = readFileSync(resolve("src/pages/Members.tsx"), "utf8");
  const prepareSource = source.slice(
    source.indexOf("async function prepareSignedAudio"),
    source.indexOf("async function handleCancelMembership"),
  );
  const selectionSource = source.slice(
    source.indexOf("function handleEpisodeChange"),
    source.indexOf("async function handlePlay"),
  );

  it("has explicit playback, retry, native-control, and focus affordances", () => {
    expect(source).toContain("Open player");
    expect(source).toContain("Play episode");
    expect(source).toContain(">\n                        Retry\n");
    expect(source).toContain("controls");
    expect(source).toContain("playerRegion.current?.focus");
    expect(source).toContain("playerRegion.current?.scrollIntoView");
  });

  it("does not verify membership inside an episode-selection request", () => {
    expect(prepareSource).not.toContain("/api/member-access");
    expect(prepareSource).not.toContain("checkMemberAccess");
    expect(selectionSource).toContain("prepareSignedAudio(id)");
    expect(selectionSource).not.toContain("checkMemberAccess");
  });

  it("authenticates every free or protected signed-audio request", () => {
    expect(prepareSource).toContain("/api/signed-audio?episodeId=");
    expect(prepareSource).toContain("Authorization: `Bearer ${token}`");
    expect(prepareSource).toContain("signal: request.signal");
    expect(prepareSource).not.toContain("episodeIsFree");
  });

  it("owns load and play analytics by the exact playback episode", () => {
    expect(prepareSource).toContain("episode_id: selectedId");
    expect(source).toContain("episode_id:\n                                playback.episodeId");
    expect(source).toContain("playbackEpisode.title");
    expect(source).not.toContain("signed_url:");
    expect(source).not.toContain("audio_url:");
  });

  it("aborts requests during reselection and unmount cleanup", () => {
    expect(source.match(/playbackRequests\.current\.abortCurrent\(\)/g))
      .not.toBeNull();
    expect(source).toContain("return () => {");
    expect(source).toContain("playbackRequests.current.isCurrent");
    expect(source).toContain("playbackRequests.current.finish");
  });

  it("handles Play rejection before dispatching an error state", () => {
    expect(source).toContain("const started = await attemptAudioPlay(audio)");
    expect(source).toContain("if (!started)");
    expect(source).toContain("Playback could not start");
  });
});
