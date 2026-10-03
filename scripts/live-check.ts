import { AirwallexClient, readSnapshot } from "../lib/server/airwallex";
import { verifyFreeModel, interpretEvidence } from "../lib/server/ai";
import { writeFile, mkdir } from "node:fs/promises";
async function main() {
  const client = new AirwallexClient();
  const snapshot = await readSnapshot();
  console.log(
    JSON.stringify(
      {
        source: snapshot.source,
        balances: snapshot.balances.filter((b) =>
          ["USD", "EUR", "GBP", "CNY"].includes(b.currency),
        ),
        globalAccounts: snapshot.globalAccounts,
        beneficiaryCorridors: snapshot.beneficiaries,
        rates: snapshot.rates,
        evidence: snapshot.evidence,
      },
      null,
      2,
    ),
  );
  const quote = await client.quote();
  console.log(
    JSON.stringify(
      {
        quote: {
          id: quote.quote_id,
          buyCurrency: quote.buy_currency,
          buyMajor: quote.buy_amount,
          sellCurrency: quote.sell_currency,
          sellMajor: quote.sell_amount,
          expiresAt: quote.valid_to_at,
        },
      },
      null,
      2,
    ),
  );
  await verifyFreeModel("nvidia/nemotron-3-super-120b-a12b:free");
  const interpretation = await interpretEvidence(
    "Customer update: the expected USD 20,000 payment is delayed by 5 days. It will arrive next week.",
  );
  console.log(JSON.stringify({ AI: interpretation }, null, 2));
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/live-read.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        snapshot,
        quote: {
          id: quote.quote_id,
          buyAmount: quote.buy_amount,
          sellAmount: quote.sell_amount,
          validUntil: quote.valid_to_at,
        },
        interpretation,
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Live check failed");
  process.exitCode = 1;
});
