export const STORY_CATEGORIES = [
  "Intuition", "Relationship lesson", "Strange encounter", "Starting over",
  "Family story", "Friendship story", "Work story", "Something I never forgot", "Other",
] as const;

export const STORY_NAME_PREFERENCES = [
  "Keep me anonymous",
  "First name only",
  "A fake name is fine",
  "Contact me before using any name",
] as const;

export const STORY_LIMITS = { title: 200, body: 12000, name: 120, email: 254 };
