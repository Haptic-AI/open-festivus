export interface IScrapeOptions {
  renderJs?: boolean;
  countryCode?: string;
  waitSeconds?: number;
  cache?: boolean;
  cacheTtlHours?: number;
  maxRetries?: number;
  thinBodyThreshold?: number;
}

export interface IScrapeResult {
  url: string;
  resolvedUrl: string;
  markdown: string;
  cost: number;
  cached: boolean;
  renderedJs: boolean;
  statusCode: number;
  fetchedAt: string;
}

export interface IScrapeCredits {
  used: number;
  max: number;
  remaining: number;
  currentConcurrency: number;
  maxConcurrency: number;
}
