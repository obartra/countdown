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

const FUNCTION_PORT = Number(process.env.FUNCTIONS_PORT ?? 8888);
const FUNCTION_HOST = `http://localhost:${FUNCTION_PORT}/.netlify/functions`;

const rewritePublishedApiPath = (path: string) => {
  const [pathname, query] = path.split("?");
  const cleaned = pathname.replace(/^\/api\/published\/?/, "");
  const slug = cleaned.replace(/^\/+/, "").split("/")[0];
  if (!slug) return `/published${query ? `?${query}` : ""}`;
  const suffix = query ? `&${query}` : "";
  return `/published?slug=${encodeURIComponent(slug)}${suffix}`;
};

const functionsProxy = (rewrite: (path: string) => string) => ({
  target: FUNCTION_HOST,
  changeOrigin: true,
  rewrite,
});

const adminReportsRewrite = (pathStr: string) => {
  const [pathname, query] = pathStr.split("?");
  const suffix = pathname.replace(/^\/admin\/reports/, "");
  if (suffix && suffix !== "/") {
    const slug = suffix.replace(/^\/+/, "");
    return `/admin-reports-slug?slug=${encodeURIComponent(slug)}${
      query ? `&${query}` : ""
    }`;
  }
  return `/admin-reports${query ? `?${query}` : ""}`;
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
      "/publish": functionsProxy(() => "/publish"),
      "/admin-stats": functionsProxy(() => "/admin-stats"),
      "/api/admin/reports": functionsProxy((pathStr) =>
        adminReportsRewrite(pathStr.replace(/^\/api/, "")),
      ),
      "/api/published": functionsProxy((path) => rewritePublishedApiPath(path)),
      "/api/report": functionsProxy((path) => {
        const [, rest] = path.split("/api/report");
        const slug = rest.replace(/^\/+/, "").split("?")[0];
        return `/report?slug=${slug}`;
      }),
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
