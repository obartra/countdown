const STORAGE_KEY = "adminSecret";

const isBrowser = () => typeof window !== "undefined";

export const getStoredAdminSecret = () => {
  if (!isBrowser()) return "";
  return window.sessionStorage.getItem(STORAGE_KEY) ?? "";
};

export const persistAdminSecret = (secret: string) => {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(STORAGE_KEY, secret);
};

export const clearStoredAdminSecret = () => {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(STORAGE_KEY);
};

export type VerifyAdminSecretResult =
  | { ok: true }
  | { ok: false; message: string };

const parseErrorMessage = (text: string, status: number) => {
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    // ignore parse errors
  }
  if (status === 401) return "Invalid admin secret.";
  return "Unable to verify admin secret. Try again.";
};

export const verifyAdminSecret = async (
  secret: string,
): Promise<VerifyAdminSecretResult> => {
  const trimmed = secret.trim();
  if (!trimmed) {
    return { ok: false, message: "Admin secret is required." };
  }

  try {
    const response = await fetch("/admin-stats", {
      method: "GET",
      headers: { "x-admin-secret": trimmed },
    });
    if (response.ok) {
      return { ok: true };
    }
    const text = await response.text();
    return { ok: false, message: parseErrorMessage(text, response.status) };
  } catch (error) {
    console.warn("Admin secret verification failed", error);
    return { ok: false, message: "Unable to verify admin secret. Try again." };
  }
};
