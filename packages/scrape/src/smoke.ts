import { scrape } from "./client.js";
import { checkCredits } from "./credits.js";

const URLS: readonly string[] = [
  "https://bostondynamics.com/products/atlas/",
  "https://www.unitree.com/g1/",
  "https://www.universal-robots.com/products/ur5e/",
];

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function err(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

async function main(): Promise<void> {
  const before = await checkCredits();
  log(
    `credits before: ${String(before.used)} / ${String(before.max)} (${String(before.remaining)} remaining)`,
  );

  let totalCost = 0;
  for (const url of URLS) {
    log(`\n→ ${url}`);
    const result = await scrape(url);
    totalCost += result.cost;
    const preview = result.markdown.slice(0, 180).replace(/\s+/g, " ");
    log(
      `  status=${String(result.statusCode)} cost=${String(result.cost)} cached=${String(result.cached)} renderedJs=${String(result.renderedJs)} length=${String(result.markdown.length)}`,
    );
    log(`  preview: ${preview}...`);
  }

  log(`\ntotal cost this run: ${String(totalCost)} credits`);

  const after = await checkCredits();
  log(
    `credits after: ${String(after.used)} / ${String(after.max)} (${String(after.remaining)} remaining)`,
  );
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  err(`smoke failed: ${msg}`);
  process.exit(1);
});
