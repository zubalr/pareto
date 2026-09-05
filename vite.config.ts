import { defineConfig, Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function echartsSsrShim(): Plugin {
  return {
    name: "echarts-ssr-shim",
    enforce: "pre",
    resolveId(source, importer, options) {
      if (options?.ssr && (source === "echarts" || source.startsWith("echarts/") || source === "zrender" || source.startsWith("zrender/"))) {
        return path.resolve(__dirname, "src/lib/empty-echarts.ts");
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    echartsSsrShim(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      srcDirectory: "src",
    }),
    react(),
    tailwindcss(),
  ],
});
