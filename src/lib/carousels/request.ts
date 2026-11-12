// ============================================================
// UXLLY — Read a carousel request from a chat message
// Pulls out size, page count and where an attached image should go, and
// decides what is unclear (so the AI asks only then).
// ============================================================
import type { CarouselSize, SlideImage } from "./types";

export interface ParsedCarouselRequest {
  topic: string; // the message, cleaned of format words
  topicClear: boolean; // false when there's no real subject ("make a carousel")
  size?: CarouselSize;
  detailCount?: number;
  imageTarget?: SlideImage["target"]; // where the attached image goes, if the message says
}

const FILLER = /\b(please|pls|can you|could you|make|create|generate|design|build|do|me|a|an|the|for|my|of|new|carousel|carousels|post|posts|slides?|pages?|ig|instagram|linkedin|square|portrait|story|stories|reel|tiktok|about|on|with|using|use|put|this|that|image|photo|picture|pic|first|last|final|intro|outro|cover|every|all|each|detail|details|size|\d+:\d+|\d+)\b/gi;

export function parseCarouselRequest(message: string): ParsedCarouselRequest {
  const m = message.toLowerCase();
  const out: ParsedCarouselRequest = { topic: message.trim(), topicClear: true };

  if (/\b4\s*[:x×]\s*5\b|portrait|1080\s*[x×]\s*1350/.test(m)) out.size = "4:5";
  else if (/\b1\s*[:x×]\s*1\b|square/.test(m)) out.size = "1:1";
  else if (/\b9\s*[:x×]\s*16\b|\bstor(y|ies)\b|\breels?\b|tiktok/.test(m)) out.size = "9:16";

  // "7 slides" / "7 pages" = total pages → details = total - 2
  const total = m.match(/(\d{1,2})\s*-?\s*(slides?|pages?)\b/);
  // "5 frameworks / tips / steps / ways / mistakes / lessons / reasons…" = details
  const items = m.match(/\b(\d{1,2})\s+(frameworks?|tips?|steps?|ways?|mistakes?|lessons?|reasons?|ideas?|rules?|habits?|signs?|things|points?|questions?|myths?|tools?|secrets?|strategies|hacks?|examples?)\b/);
  if (total) out.detailCount = Math.min(10, Math.max(1, parseInt(total[1], 10) - 2));
  else if (items) out.detailCount = Math.min(10, Math.max(1, parseInt(items[1], 10)));

  if (/\b(first|intro|cover|opening)\b|slide\s*1\b|page\s*1\b/.test(m)) out.imageTarget = "intro";
  else if (/\b(last|final|outro|ending|closing)\b/.test(m)) out.imageTarget = "outro";
  else if (/\b(every|all|each)\s+(detail|middle|content|inside)/.test(m)) out.imageTarget = "details";
  else {
    const n = m.match(/(?:slide|page)\s*(\d{1,2})\b/);
    if (n) out.imageTarget = parseInt(n[1], 10);
  }

  const words = m.replace(FILLER, " ").replace(/[^a-zÀ-ɏ\s'-]/gi, " ").split(/\s+/).filter((w) => w.length > 2);
  out.topicClear = words.length >= 1;
  return out;
}
