import type { Task } from "@/db/schema";

type Context = NonNullable<Task["context"]>;

// Words that name a context after "@", in English (the stored value) or Hebrew (the label).
const CONTEXT_WORDS: Record<string, Context> = {
  focus: "@focus",
  quick: "@quick",
  out: "@out",
  home: "@home",
  "ריכוז": "@focus",
  "קצר": "@quick",
  "בחוץ": "@out",
  "בבית": "@home",
  "בית": "@home",
};

// Quick add: "להתקשר לשמאי @קצר" -> title "להתקשר לשמאי", context @quick. The first known
// @word wins and is removed; anything else starting with @ stays part of the title.
export function parseQuickAdd(text: string): { title: string; context: Context | null } {
  let context: Context | null = null;
  const title = text
    .replace(/(^|\s)@(\S+)/g, (match, space: string, word: string) => {
      const found = CONTEXT_WORDS[word.toLowerCase()];
      if (!found || context) return match;
      context = found;
      return space;
    })
    .replace(/\s+/g, " ")
    .trim();
  return title ? { title, context } : { title: text.trim(), context: null };
}
