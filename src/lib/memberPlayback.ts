export type PlaybackPhase =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "error";

export type PlaybackState = {
  phase: PlaybackPhase;
  episodeId: string;
  requestId: number | null;
  signedUrl: string | null;
  message: string;
};

export type PlaybackAction =
  | { type: "select"; episodeId: string }
  | { type: "loading"; episodeId: string; requestId: number }
  | {
      type: "ready";
      episodeId: string;
      requestId: number;
      signedUrl: string;
    }
  | { type: "playing"; episodeId: string; requestId: number }
  | { type: "paused"; episodeId: string; requestId: number }
  | {
      type: "error";
      episodeId: string;
      requestId: number;
      message: string;
      signedUrl?: string | null;
    };

export function createInitialPlaybackState(episodeId: string): PlaybackState {
  return {
    phase: "idle",
    episodeId,
    requestId: null,
    signedUrl: null,
    message: "",
  };
}

function ownsPlaybackRequest(
  state: PlaybackState,
  action: Exclude<PlaybackAction, { type: "select" | "loading" }>,
): boolean {
  return (
    state.requestId === action.requestId &&
    state.episodeId === action.episodeId
  );
}

export function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction,
): PlaybackState {
  if (action.type === "select") {
    return createInitialPlaybackState(action.episodeId);
  }

  if (action.type === "loading") {
    if (state.requestId !== null && action.requestId < state.requestId) {
      return state;
    }
    return {
      phase: "loading",
      episodeId: action.episodeId,
      requestId: action.requestId,
      signedUrl: null,
      message: "",
    };
  }

  if (!ownsPlaybackRequest(state, action)) {
    return state;
  }

  if (action.type === "ready") {
    return {
      ...state,
      phase: "ready",
      signedUrl: action.signedUrl,
      message: "Ready to play.",
    };
  }

  if (action.type === "playing") {
    if (!state.signedUrl) return state;
    return {
      ...state,
      phase: "playing",
      message: "Playing now.",
    };
  }

  if (action.type === "paused") {
    if (!state.signedUrl) return state;
    return {
      ...state,
      phase: "ready",
      message: "Ready to play.",
    };
  }

  return {
    ...state,
    phase: "error",
    signedUrl: action.signedUrl ?? null,
    message: action.message,
  };
}

export type PlaybackRequest = {
  requestId: number;
  signal: AbortSignal;
};

export type PlaybackRequestManager = {
  begin: () => PlaybackRequest;
  isCurrent: (requestId: number) => boolean;
  finish: (requestId: number) => boolean;
  abortCurrent: () => void;
};

export function createPlaybackRequestManager(): PlaybackRequestManager {
  let nextRequestId = 0;
  let current:
    | { requestId: number; controller: AbortController }
    | null = null;

  return {
    begin() {
      current?.controller.abort();
      const controller = new AbortController();
      nextRequestId += 1;
      current = { requestId: nextRequestId, controller };
      return { requestId: nextRequestId, signal: controller.signal };
    },
    isCurrent(requestId) {
      return current?.requestId === requestId;
    },
    finish(requestId) {
      if (current?.requestId !== requestId) return false;
      current = null;
      return true;
    },
    abortCurrent() {
      current?.controller.abort();
      current = null;
    },
  };
}

export function playerScrollBehavior(
  stackedLayout: boolean,
  prefersReducedMotion: boolean,
): ScrollBehavior | null {
  if (!stackedLayout) return null;
  return prefersReducedMotion ? "auto" : "smooth";
}

export async function attemptAudioPlay(
  audio: Pick<HTMLAudioElement, "play">,
): Promise<boolean> {
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
