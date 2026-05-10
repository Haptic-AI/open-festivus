import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { IScrapeOptions, IScrapeResult } from "./types.js";

const CACHE_DIR = ".cache/scrape";

function cacheKey(url: string, opts: IScrapeOptions): string {
  const normalized = {
    url,
    renderJs: opts.renderJs ?? false,
    countryCode: opts.countryCode ?? "us",
    waitSeconds: opts.waitSeconds ?? 1,
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function cachePath(key: string): string {
  return join(CACHE_DIR, `${key}.json.gz`);
}

export async function readFromCache(
  url: string,
  opts: IScrapeOptions,
): Promise<IScrapeResult | null> {
  const key = cacheKey(url, opts);
  const path = cachePath(key);
  try {
    const ttlHours = opts.cacheTtlHours ?? 168;
    const st = await stat(path);
    const ageMs = Date.now() - st.mtimeMs;
    if (ageMs > ttlHours * 3_600 * 1_000) return null;
    const gz = await readFile(path);
    const json = gunzipSync(gz).toString("utf8");
    const parsed = JSON.parse(json) as IScrapeResult;
    return { ...parsed, cached: true, cost: 0 };
  } catch {
    return null;
  }
}

export async function writeToCache(
  url: string,
  opts: IScrapeOptions,
  result: IScrapeResult,
): Promise<void> {
  const key = cacheKey(url, opts);
  const path = cachePath(key);
  await mkdir(dirname(path), { recursive: true });
  const gz = gzipSync(Buffer.from(JSON.stringify(result)));
  await writeFile(path, gz);
}
