import { useCallback, useEffect, useState } from "react";
import {
  clearStoredAdminSecret,
  getStoredAdminSecret,
  persistAdminSecret,
  verifyAdminSecret,
} from "./adminAuthClient";

export type AdminAuthStatus = "idle" | "pending" | "success" | "error";

export const useAdminAuth = () => {
  const initialStoredSecret = getStoredAdminSecret();
  const [secretInput, setSecretInput] = useState<string>(
    () => initialStoredSecret,
  );
  const [secret, setSecret] = useState<string>("");
  const [status, setStatus] = useState<AdminAuthStatus>(() =>
    initialStoredSecret ? "pending" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const runVerification = useCallback(async (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) {
      setStatus("error");
      setError("Admin secret is required.");
      setSecret("");
      clearStoredAdminSecret();
      return false;
    }

    setStatus("pending");
    setError(null);

    try {
      const result = await verifyAdminSecret(trimmed);
      if (result.ok) {
        setSecret(trimmed);
        setStatus("success");
        persistAdminSecret(trimmed);
        return true;
      }
      const message =
        "message" in result
          ? result.message
          : "Unable to verify admin secret. Try again.";
      setSecret("");
      setStatus("error");
      setError(message);
      clearStoredAdminSecret();
      return false;
    } catch (error) {
      console.warn("Admin secret verification failed", error);
      setSecret("");
      setStatus("error");
      setError("Unable to verify admin secret. Try again.");
      clearStoredAdminSecret();
      return false;
    }
  }, []);

  useEffect(() => {
    const stored = getStoredAdminSecret();
    if (!stored) return;
    runVerification(stored).catch(() => {
      setSecret("");
      setStatus("error");
      setError("Unable to verify admin secret. Try again.");
      clearStoredAdminSecret();
    });
  }, [runVerification]);

  const clear = useCallback(() => {
    setSecret("");
    setSecretInput("");
    setStatus("idle");
    setError(null);
    clearStoredAdminSecret();
  }, []);

  const hasSecret = status === "success" && Boolean(secret);

  return {
    secret,
    secretInput,
    setSecretInput,
    status,
    error,
    hasSecret,
    verify: runVerification,
    clear,
  };
};
