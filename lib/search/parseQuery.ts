// Deterministic natural-language query parsing. No LLM call — this is a
// simple, auditable heuristic that covers the query shapes Khoj is built for
// (comma/"and"-separated grocery lists, optional leading quantities, a few
// common filler phrases). It intentionally does not try to expand vague
// requests like "ingredients for pasta" into a fabricated ingredient list —
// it treats the named dish/product as the search term and lets the
// providers' real catalogues answer.

export interface ParsedItem {
  /** The exact text to search each provider with. */
  term: string;
  /** How many units the user asked for, e.g. "2 packets Maggi" -> 2. */
  count: number;
}

const LEADING_PHRASES = [
  /^i\s+(need|want)\s+/i,
  /^get\s+me\s+/i,
  /^can\s+you\s+(get|order|find)\s+(me\s+)?/i,
  /^order\s+/i,
  /^buy\s+/i,
  /^find\s+/i,
  /^ingredients\s+for\s+/i,
];

const QUANTITY_PREFIX = /^(\d+)\s*(packets?|packs?|pkts?|bottles?|pieces?|pcs?|kg|g|l|ml|dozen|units?)?\s*(of\s+)?/i;

function stripLeadingPhrases(input: string): string {
  let text = input.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of LEADING_PHRASES) {
      if (re.test(text)) {
        text = text.replace(re, "");
        changed = true;
      }
    }
  }
  return text.trim();
}

function splitIntoFragments(input: string): string[] {
  return input
    .split(/,| and | & |;/i)
    .map((f) => f.trim())
    .filter(Boolean);
}

function extractQuantity(fragment: string): ParsedItem {
  const match = fragment.match(QUANTITY_PREFIX);
  if (match && match[1]) {
    const count = parseInt(match[1], 10);
    const remainder = fragment.slice(match[0].length).trim();
    if (remainder) {
      return { term: remainder, count: Number.isFinite(count) && count > 0 ? count : 1 };
    }
  }
  return { term: fragment, count: 1 };
}

export function parseQuery(rawQuery: string): ParsedItem[] {
  const cleaned = stripLeadingPhrases(rawQuery);
  const fragments = splitIntoFragments(cleaned);

  if (fragments.length === 0) {
    return [];
  }

  return fragments.map(extractQuantity).filter((item) => item.term.length > 0);
}
