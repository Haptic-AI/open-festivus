import { readFromCache, writeToCache } from "./cache.js";
import { getScrapingBeeKey } from "./env.js";
import type { IScrapeOptions, IScrapeResult } from "./types.js";

const SCRAPINGBEE_BASE = "https://app.scrapingbee.com/api/v1/";
const DEFAULT_TIMEOUT_MS = 90_000;
const BACKOFF_BASE_MS = 5_000;

interface IScrapingBeeEnvelope {
  body: string;
  cost: number;
  "initial-status-code": number;
  "resolved-url": string;
}

class ScrapingBeeError extends Error {
  statusCode: number | undefined;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "ScrapingBeeError";
    this.statusCode = statusCode;
  }
}

async function doFetch(
  url: string,
  renderJs: boolean,
  opts: IScrapeOptions,
): Promise<IScrapingBeeEnvelope> {
  const apiKey = getScrapingBeeKey();
  const params = new URLSearchParams({
    api_key: apiKey,
    url,
    premium_proxy: "true",
    country_code: opts.countryCode ?? "us",
    wait: String(opts.waitSeconds ?? 1),
    block_ads: "true",
    json_response: "true",
    return_page_markdown: "true",
  });
  if (renderJs) params.set("render_js", "true");
  const fullUrl = `${SCRAPINGBEE_BASE}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const resp = await fetch(fullUrl, { signal: controller.signal });
    if (!resp.ok) {
      throw new ScrapingBeeError(
        `ScrapingBee returned ${String(resp.status)}: ${resp.statusText}`,
        resp.status,
      );
    }
    const envelope = (await resp.json()) as IScrapingBeeEnvelope;
    return envelope;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(statusCode: number | undefined): boolean {
  if (statusCode === undefined) return true;
  if (statusCode === 429) return true;
  if (statusCode >= 500) return true;
  return false;
}

async function fetchWithRetry(
  url: string,
  renderJs: boolean,
  opts: IScrapeOptions,
): Promise<IScrapingBeeEnvelope> {
  const maxRetries = opts.maxRetries ?? 3;
  let attempt = 0;
  while (true) {
    try {
      return await doFetch(url, renderJs, opts);
    } catch (error) {
      attempt += 1;
      if (attempt >= maxRetries) throw error;
      const statusCode =
        error instanceof ScrapingBeeError ? error.statusCode : undefined;
      if (!isRetryable(statusCode)) throw error;
      const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
      await sleep(backoff);
    }
  }
}

export async function scrape(
  url: string,
  opts: IScrapeOptions = {},
): Promise<IScrapeResult> {
  if (opts.cache !== false) {
    const cached = await readFromCache(url, opts);
    if (cached !== null) return cached;
  }

  const renderJsInitial = opts.renderJs ?? false;
  let envelope = await fetchWithRetry(url, renderJsInitial, opts);
  let renderedJs = renderJsInitial;
  let totalCost = envelope.cost;

  const threshold = opts.thinBodyThreshold ?? 500;
  if (!renderJsInitial && envelope.body.length < threshold) {
    envelope = await fetchWithRetry(url, true, opts);
    totalCost += envelope.cost;
    renderedJs = true;
  }

  const result: IScrapeResult = {
    url,
    resolvedUrl: envelope["resolved-url"],
    markdown: envelope.body,
    cost: totalCost,
    cached: false,
    renderedJs,
    statusCode: envelope["initial-status-code"],
    fetchedAt: new Date().toISOString(),
  };

  if (opts.cache !== false) await writeToCache(url, opts, result);
  return result;
}
