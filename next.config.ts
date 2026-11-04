import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite só é usado nos testes; não precisa entrar no bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
