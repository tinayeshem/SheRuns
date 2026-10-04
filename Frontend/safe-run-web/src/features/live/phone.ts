// returns the number in international format, or null if it has no country code
export function normalizePhone(raw: string): string | null {
  let p = raw.replace(/[\s\-().]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  return /^\+[1-9]\d{7,14}$/.test(p) ? p : null;
}