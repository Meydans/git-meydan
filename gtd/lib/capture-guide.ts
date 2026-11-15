import { readFileSync } from "node:fs";
import path from "node:path";

// skills/gtd-capture/SKILL.md is the one source for the capture rules: it is uploaded to Claude
// as a skill, and the MCP "capture" prompt serves the same text (next.config.ts traces the file).
let guide: string | undefined;

export function captureGuide() {
  guide ??= readFileSync(path.join(process.cwd(), "skills/gtd-capture/SKILL.md"), "utf8").replace(/^---\n[\s\S]*?\n---\n+/, "");
  return guide;
}
