import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";

const serveDocsEmojis = (): Plugin => {
  const emojiDir = path.resolve(__dirname, "dist/emojis");
  return {
    name: "serve-docs-emojis",
    configureServer(server) {
      server.middlewares.use("/emojis", (req, res, next) => {
        if (!req.url) return next();
        const cleanedPath = decodeURIComponent(req.url.split("?")[0]).replace(
          /^\/+/,
          "",
        );
        const filePath = path.join(emojiDir, cleanedPath);
        if (!filePath.startsWith(emojiDir)) return next();

        fs.stat(filePath, (error, stats) => {
          if (error || !stats.isFile()) {
            next();
            return;
          }
          res.setHeader("Content-Type", "image/svg+xml");
          fs.createReadStream(filePath).pipe(res);
        });
      });
    },
  };
};

export default defineConfig(() => ({
  plugins: [react(), serveDocsEmojis()],
  base: "/",
  server: {
    host: true,
    port: 8080,
    proxy: {
      "/api/openverse": {
        target: "https://api.openverse.engineering",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openverse/, ""),
      },
    },
  },
  preview: {
    host: true,
    port: 8080,
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    css: true,
  },
}));
