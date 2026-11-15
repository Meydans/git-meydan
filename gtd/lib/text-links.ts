// Web addresses inside free text (notes, outcomes), turned into short, friendly links.
// Only http(s) addresses become links, so nothing else in the text can turn clickable.

export type LinkKind = "doc" | "sheet" | "slides" | "folder" | "file" | "web";
export type TextPart = string | { url: string; label: string; kind: LinkKind };

const URL_RE = /https?:\/\/[^\s<>"']+/g;
// Punctuation that ends a sentence rather than the address.
const TRAILING = /[.,;:!?)\]}"'׳״»]+$/;

export function describeLink(url: string): { label: string; kind: LinkKind } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { label: url, kind: "web" };
  }
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname;
  if (host === "docs.google.com") {
    if (path.startsWith("/document/")) return { label: "מסמך Google", kind: "doc" };
    if (path.startsWith("/spreadsheets/")) return { label: "גיליון Google", kind: "sheet" };
    if (path.startsWith("/presentation/")) return { label: "מצגת Google", kind: "slides" };
    if (path.startsWith("/forms/")) return { label: "טופס Google", kind: "doc" };
  }
  if (host === "drive.google.com") {
    if (path.includes("/folders/")) return { label: "תיקייה ב-Drive", kind: "folder" };
    return { label: "קובץ ב-Drive", kind: "file" };
  }
  return { label: host, kind: "web" };
}

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    let url = match[0];
    const trail = TRAILING.exec(url)?.[0] ?? "";
    url = url.slice(0, url.length - trail.length);
    const start = match.index!;
    if (start > last) parts.push(text.slice(last, start));
    parts.push({ url, ...describeLink(url) });
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Every link in a text, once each (for the list under the notes editor).
export function linksIn(text: string | null) {
  if (!text) return [];
  const seen = new Set<string>();
  return splitLinks(text).filter((p): p is Exclude<TextPart, string> => typeof p !== "string" && !seen.has(p.url) && !!seen.add(p.url));
}
