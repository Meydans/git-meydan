export type NoteLine =
  | { kind: "text"; text: string }
  | { kind: "check"; text: string; checked: boolean; index: number };

const CHECK = /^\s*[-*]\s\[( |x|X)\]\s?(.*)$/;

// Notes are plain text; lines like "- [ ] item" render as checklist items.
export function parseNotes(notes: string): NoteLine[] {
  return notes.split("\n").map((line, index) => {
    const match = CHECK.exec(line);
    return match
      ? { kind: "check", text: match[2], checked: match[1] !== " ", index }
      : { kind: "text", text: line };
  });
}

export function toggleLine(notes: string, index: number) {
  const lines = notes.split("\n");
  const match = CHECK.exec(lines[index] ?? "");
  if (!match) return notes;
  lines[index] = lines[index].replace(/\[( |x|X)\]/, match[1] === " " ? "[x]" : "[ ]");
  return lines.join("\n");
}
