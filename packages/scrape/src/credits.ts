import { getScrapingBeeKey } from "./env.js";
import type { IScrapeCredits } from "./types.js";

const USAGE_URL = "https://app.scrapingbee.com/api/v1/usage";

interface IUsageEnvelope {
  max_api_credit: number;
  used_api_credit: number;
  max_concurrency: number;
  current_concurrency: number;
}

export async function checkCredits(): Promise<IScrapeCredits> {
  const apiKey = getScrapingBeeKey();
  const url = `${USAGE_URL}?api_key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(
      `ScrapingBee /usage returned ${String(resp.status)}: ${resp.statusText}`,
    );
  }
  const envelope = (await resp.json()) as IUsageEnvelope;
  return {
    used: envelope.used_api_credit,
    max: envelope.max_api_credit,
    remaining: envelope.max_api_credit - envelope.used_api_credit,
    currentConcurrency: envelope.current_concurrency,
    maxConcurrency: envelope.max_concurrency,
  };
}
