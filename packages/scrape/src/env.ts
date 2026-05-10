export function getScrapingBeeKey(): string {
  const key = process.env["SCRAPINGBEE_API_KEY"];
  if (key === undefined || key.length === 0) {
    throw new Error(
      "SCRAPINGBEE_API_KEY env var is not set. Add it to .env.local before calling @festivus/scrape.",
    );
  }
  return key;
}
