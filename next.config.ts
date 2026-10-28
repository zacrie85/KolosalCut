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
