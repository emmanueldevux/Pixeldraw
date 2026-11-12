// UXLLY — the URL the editor should use for an image (same-origin proxy for our own storage; see /api/slideshow/img)
export function viewUrl(url: string): string {
  const base = process.env.R2_PUBLIC_URL || "";
  return base && url.startsWith(base) ? `/api/slideshow/img?u=${encodeURIComponent(url)}` : url;
}
