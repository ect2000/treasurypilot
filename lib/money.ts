import Decimal from "decimal.js";
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
export type Currency = "USD" | "EUR" | "GBP" | "CNY";
export const currencies: Currency[] = ["USD", "EUR", "GBP", "CNY"];
export function minor(major: Decimal.Value, currency: string = "USD"): number {
  const precision = ["JPY", "KRW", "VND"].includes(currency)
    ? 0
    : ["BHD", "KWD", "OMR"].includes(currency)
      ? 3
      : 2;
  const value = new Decimal(major)
    .mul(new Decimal(10).pow(precision))
    .toDecimalPlaces(0);
  if (!value.isFinite() || value.abs().gt(Number.MAX_SAFE_INTEGER))
    throw new Error("Invalid monetary amount");
  return value.toNumber();
}
export function major(value: number, currency: string = "USD"): string {
  const precision = ["JPY", "KRW", "VND"].includes(currency)
    ? 0
    : ["BHD", "KWD", "OMR"].includes(currency)
      ? 3
      : 2;
  if (!Number.isSafeInteger(value))
    throw new Error("Money must be integer minor units");
  return new Decimal(value)
    .div(new Decimal(10).pow(precision))
    .toFixed(precision);
}
export function usdCost(amountMinor: number, usdPerUnit: string): number {
  return new Decimal(amountMinor).mul(usdPerUnit).ceil().toNumber();
}
export function formatMoney(value: number, currency = "USD", compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: compact ? 0 : 2,
  }).format(Number(major(value, currency)));
}
