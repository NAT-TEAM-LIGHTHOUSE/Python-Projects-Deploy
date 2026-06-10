import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // VITE_API_PROXY can be set to the FASTAPI backend
  // example: http://localhost:8000
  const apiProxy = env.VITE_API_PROXY;

  const allowedOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):(8100|8101|8080)$/;

  return defineConfig({
    // App is hosted under this shared base path (must end with a slash)
    base: "/web/agentai/process_gpt/",

    // Build output is nested so the static server can serve `/web/agentai/process_gpt/*`
    // directly from `dist/` without requiring any source code.
    build: {
      outDir: "dist/web/agentai/process_gpt",
      emptyOutDir: true,
    },

    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
        },
      },
    },

    server: {
      host: "::",
      port: 8080,
      // Allow apps on :8100 and :8101 to call this dev server (dev-only).
      cors:
        mode === "development"
          ? {
              origin: allowedOrigin,
              credentials: true,
            }
          : false,
      hmr: {
        overlay: false,
      },
      proxy:
        mode === "development" && apiProxy
          ? {
              "/api": {
                target: apiProxy,
                changeOrigin: true,
                secure: false,
              },
            }
          : undefined,
    },

    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // Prevent duplicate React copies when resolving deps outside `frontend/` (repo root has React 19).
        react: path.resolve(__dirname, "./node_modules/react"),
        "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
        "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime"),
        "react/jsx-dev-runtime": path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime"),
      },
      dedupe: ["react", "react-dom"],
    },
  });
};
