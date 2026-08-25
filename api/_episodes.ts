export const EPISODE_FILE_MAP: Record<
  string,
  { preview: string | null; full: string }
> = {
  "versions-ep5": {
    preview: "never-meant-to-see-ep5/preview.mp3",
    full: "versions-ep5/full.mp3",
  },
  "conversation-ep2": {
    preview: null,
    full: "conversation-ep2/full.mp3",
  },
  "replays-ep1": {
    preview: "replays-ep1/preview.mp3",
    full: "replays-ep1/full.mp3",
  },
  "say-sorry-ep3": {
    preview: "say-sorry-ep3/preview.mp3",
    full: "say-sorry-ep3/full.mp3",
  },
  "resentment-ep4": {
    preview: "resentment-ep4/preview.mp3",
    full: "resentment-ep4/full.mp3",
  },
  "im-fine-ep6": {
    preview: null,
    full: "im-fine-ep6/full.mp3",
  },
  "lonely-night-ep7": {
    preview: "lonely-night-ep7/preview.mp3",
    full: "lonely-night-ep7/full.mp3",
  },
  "lonely-night-part2-ep8": {
    preview: "lonely-night-part2-ep8/preview.mp3",
    full: "lonely-night-part2-ep8/full.mp3",
  },
  "had-everything-part1-ep9": {
    preview: null,
    full: "had-everything-part1-ep9/full.mp3",
  },
  "had-everything-part2-ep10": {
    preview: null,
    full: "had-everything-part2-ep10/full.mp3",
  },
  "never-made-you-guess-ep11": {
    preview: null,
    full: "never-made-you-guess-ep11/full.mp3",
  },
  "the-hardest-people-ep12": {
    preview: null,
    full: "the-hardest-people-ep12/full.mp3",
  },
  "life-you-didnt-get-ep13": {
    preview: null,
    full: "life-you-didnt-get-ep13/full.mp3",
  },
  "toast-ep14": {
    preview: null,
    full: "toast-ep14/full.mp3",
  },
  "love-him-anyway-15": {
    preview: null,
    full: "love-him-anyway-15/full.mp3",
  },
};

export function isApprovedEpisodeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(EPISODE_FILE_MAP, value)
  );
}
