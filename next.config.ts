import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// Versi aplikasi dibaca saat build -> tampil di header UI (bukti versi yang benar berjalan)
let APP_VERSION = "dev";
try {
  const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
  APP_VERSION = pkg.version;
} catch {
  /* abaikan */
}

const nextConfig: NextConfig = {
  output: "standalone",
  // v1.3.5: kunci akar proyek — tanpa ini Next 16 mendeteksi bun.lock di folder
  // induk dan menyarangkan output standalone ke .next/standalone/KolosalCut/,
  // sehingga post-build.mjs & electron/main.js tidak menemukan server.js.
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
