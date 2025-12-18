#!/usr/bin/env node

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// Lightweight .env loader so ADMIN_SECRET and other vars are available to Netlify CLI
try {
  const dotenvPath = path.join(process.cwd(), ".env");
  const content = fs.readFileSync(dotenvPath, "utf-8");
  for (const line of content.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawVal] = match;
    // Remove optional surrounding quotes
    const val = rawVal.replace(/^['"]|['"]$/g, "");
    const shouldForceOverride = key === "ADMIN_SECRET";
    if (shouldForceOverride || !(key in process.env)) {
      process.env[key] = val;
    }
    if (key === "ADMIN_SECRET") {
      if (!process.env.ADMIN_SECRET_LOCAL) {
        process.env.ADMIN_SECRET_LOCAL = val;
      }
      if (!process.env.ADMIN_SECRET_DEV) {
        process.env.ADMIN_SECRET_DEV = val;
      }
    }
  }
} catch {
  // No .env found; continue
}

const port = process.env.FUNCTIONS_PORT || "8888";
const netlifyHome = path.join(process.cwd(), ".netlify", "cli-home");

try {
  fs.mkdirSync(netlifyHome, { recursive: true });
} catch {
  // Best effort; Netlify CLI will surface any real issues.
}

const child = spawn("netlify", ["functions:serve", "--port", port], {
  env: {
    ...process.env,
    HOME: netlifyHome,
    NETLIFY_CLI_DISABLE_UPDATE_NOTIFIER:
      process.env.NETLIFY_CLI_DISABLE_UPDATE_NOTIFIER ?? "1",
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("Failed to start Netlify functions:", error);
  process.exit(1);
});
