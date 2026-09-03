// Ghana phone normalization — ONE source of truth.
// Users type 0244123456, +233 24 412 3456, 233244123456, "024-412-3456" …
// The DB stores the LOCAL form (0XXXXXXXXX). Every phone-taking route
// normalizes through here so lookups never silently fail on format.

export function normalizeGhanaPhone(raw: string): string {
  if (!raw) return "";
  let p = String(raw).replace(/[\s\-()+.]/g, "").trim(); // strip separators
  // international → local: +233 / 233 prefix → 0
  if (/^233\d{9}$/.test(p)) p = "0" + p.slice(3);
  if (/^00233\d{9}$/.test(p)) p = "0" + p.slice(5);
  return p;
}

// Validate the local Ghana mobile format: 0 + 9 digits (MTN/Telecel/AT prefixes)
export function isValidGhanaPhone(p: string): boolean {
  return /^0(2|5)\d{8}$/.test(p);
}