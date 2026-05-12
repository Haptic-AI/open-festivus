import type { NextConfig } from "next"

const buildDir = process.env["NEXT_BUILD_DIR"]

const OPENAPI_SPEC_URL =
  "https://api.festivus.hapticlabs.ai/v1/openapi.json"

const nextConfig: NextConfig = {
  ...(buildDir !== undefined ? { distDir: buildDir } : {}),
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@festivus/types"],

  // Well-known pointers to the OpenAPI spec so LLMs and agent tooling can
  // discover the write surface without scraping the marketing site.
  // `permanent: false` → HTTP 307 so we can change the destination later
  // without fighting browser caches.
  async redirects() {
    return [
      { source: "/llm", destination: OPENAPI_SPEC_URL, permanent: false },
      { source: "/agents", destination: OPENAPI_SPEC_URL, permanent: false },
      { source: "/agents.txt", destination: OPENAPI_SPEC_URL, permanent: false },
    ]
  },
}

export default nextConfig
