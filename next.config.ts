import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import path from "path";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Self-contained server build for containerized deploys (Railway/Render).
  output: "standalone",
  // Pin the workspace root explicitly: this repo sits next to unrelated
  // projects that also have a package-lock.json, which makes Next.js infer
  // the wrong root and warn about it.
  outputFileTracingRoot: projectRoot,
  images: {
    remotePatterns: [
      // URLs firmadas de Cloudflare R2 para fotos de clientes/cortes — ver
      // src/lib/storage/r2.ts y AGENTS.md.
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
};

export default nextConfig;
