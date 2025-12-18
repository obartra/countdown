const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 48;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RANDOM_CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";

export const normalizeSlugInput = (
  value: string | null | undefined,
): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < MIN_SLUG_LENGTH ||
    normalized.length > MAX_SLUG_LENGTH
  ) {
    return null;
  }

  if (!SLUG_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
};

export const generateRandomSlug = (length = 7): string => {
  let slug = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * RANDOM_CHARSET.length);
    slug += RANDOM_CHARSET[index];
  }
  return slug;
};
