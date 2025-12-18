import fs from "node:fs";
import path from "node:path";

/**
 * Best-effort .env loader for Netlify functions during local dev.
 * In production, rely on platform env vars.
 */
export const loadEnvIfMissing = (keys: string[]) => {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length === 0) return;

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(__dirname, "..", "..", ".env"),
    path.resolve(__dirname, "..", "..", "..", ".env"),
    path.resolve(__dirname, "..", "..", "..", "..", ".env"),
  ];

  for (const envPath of candidates) {
    try {
      if (!fs.existsSync(envPath)) continue;
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        if (!line || line.startsWith("#")) continue;
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const [, key, rawVal] = match;
        if (!missing.includes(key)) continue;
        const val = rawVal.replace(/^['"]|['"]$/g, "");
        if (!(key in process.env)) {
          process.env[key] = val;
        }
      }
      // Recompute missing after loading a file
      const stillMissing = keys.filter((key) => !process.env[key]);
      if (stillMissing.length === 0) return;
    } catch {
      // Try next candidate
    }
  }
};
