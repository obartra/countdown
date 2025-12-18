import { loadEnvIfMissing } from "./loadEnv";

const normalizeSecret = (value?: string | null) =>
  typeof value === "string" ? value.trim() : "";

const getHeaderValue = (
  headers: Record<string, string | undefined> | undefined,
  name: string,
) => {
  if (!headers) return "";
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return normalizeSecret(value);
    }
  }
  return "";
};

const unique = (values: string[]) => Array.from(new Set(values));

export const getAdminSecrets = () => {
  loadEnvIfMissing(["ADMIN_SECRET", "ADMIN_SECRET_LOCAL", "ADMIN_SECRET_DEV"]);
  return unique(
    [
      normalizeSecret(process.env.ADMIN_SECRET),
      normalizeSecret(process.env.ADMIN_SECRET_LOCAL),
      normalizeSecret(process.env.ADMIN_SECRET_DEV),
    ].filter(Boolean),
  );
};

type CheckOptions = {
  headerName?: string;
};

export const checkAdminAuth = (
  headers: Record<string, string | undefined> | undefined,
  options: CheckOptions = {},
) => {
  const allowedSecrets = getAdminSecrets();
  const provided = getHeaderValue(
    headers,
    options.headerName ?? "x-admin-secret",
  );
  const authorized =
    allowedSecrets.length > 0 &&
    Boolean(provided) &&
    allowedSecrets.includes(provided);

  return {
    authorized,
    hasConfiguredSecret: allowedSecrets.length > 0,
    providedLabel: provided ? "(provided)" : "none",
  };
};
