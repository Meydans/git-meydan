import { ExternalLink, FileSpreadsheet, FileText, Folder, Presentation, File } from "lucide-react";
import { splitLinks, type LinkKind } from "@/lib/text-links";

const icons: Record<LinkKind, typeof FileText> = { doc: FileText, sheet: FileSpreadsheet, slides: Presentation, folder: Folder, file: File, web: ExternalLink };

export function TextLink({ url, label, kind }: { url: string; label: string; kind: LinkKind }) {
  const Icon = icons[kind];
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`text-link link-${kind}`} title={url}>
      <Icon size={13} aria-hidden />
      {label}
    </a>
  );
}

// Plain text with its web addresses shown as short, clickable links.
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) => (typeof part === "string" ? part : <TextLink key={i} {...part} />))}
    </>
  );
}
