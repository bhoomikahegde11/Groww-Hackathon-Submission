export const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

/** Trims/uppercases and validates a stock symbol; null if invalid. */
export function normalizeSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const symbol = raw.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) return null;
  return symbol;
}
