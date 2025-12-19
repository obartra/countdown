#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");
const cleanSignals = new Set(["SIGINT", "SIGTERM"]);
const killTimeoutMs = Number(process.env.E2E_SHUTDOWN_TIMEOUT ?? 5000);

const viteBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vite.cmd" : "vite",
);
const functionsScript = path.join(
  process.cwd(),
  "scripts",
  "serve-functions.js",
);
const viteHost = process.env.HOST || "127.0.0.1";
const vitePort = String(process.env.PORT || "8080");

const children = [
  spawn(viteBin, ["dev", "--host", viteHost, "--port", vitePort], {
    stdio: "inherit",
  }),
  spawn(process.execPath, [functionsScript], { stdio: "inherit" }),
];
const childDone = new Array(children.length).fill(false);

let shuttingDown = false;
let exitCode = 0;
let remaining = children.length;

const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  const killSignal = signal && cleanSignals.has(signal) ? signal : "SIGTERM";

  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    try {
      child.kill(killSignal);
    } catch (error) {
      if (error && error.code !== "ESRCH") {
        console.error("Failed to stop child process:", error);
      }
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode !== null || child.signalCode !== null) continue;
      try {
        child.kill("SIGKILL");
      } catch (error) {
        if (error && error.code !== "ESRCH") {
          console.error("Failed to force stop child process:", error);
        }
      }
    }
  }, killTimeoutMs).unref();
};

const handleExit = (index) => {
  if (childDone[index]) return;
  childDone[index] = true;
  remaining -= 1;
  if (remaining <= 0) {
    process.exit(exitCode);
  }
};

children.forEach((child, index) => {
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      if (signal && cleanSignals.has(signal)) {
        exitCode = 0;
        shutdown(signal);
      } else {
        exitCode = typeof code === "number" && code !== 0 ? code : 1;
        shutdown("SIGTERM");
      }
    }
    handleExit(index);
  });

  child.on("error", (error) => {
    console.error(`Failed to start child process ${index}:`, error);
    if (!shuttingDown) {
      exitCode = 1;
      shutdown("SIGTERM");
    }
    handleExit(index);
  });
});

for (const signal of cleanSignals) {
  process.on(signal, () => {
    if (shuttingDown) return;
    exitCode = 0;
    shutdown(signal);
  });
}

process.on("exit", () => {
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    try {
      child.kill("SIGTERM");
    } catch {
      // Ignore errors during shutdown.
    }
  }
});
