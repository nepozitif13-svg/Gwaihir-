// Mode A scoring — verbatim memorization over token arrays.

export interface MemorizationResult {
  memorizationScore: number; // 0-100
  label: "Strong memorization signal" | "Partial" | "No meaningful overlap";
  longestRun: number; // tokens
  leadingExactMatch: number; // tokens
  suffixTokenCount: number;
  // index span (token indices) of the longest matching run inside trueSuffix tokens
  matchStart: number;
  matchEnd: number; // exclusive
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(s: string): string[] {
  const n = normalize(s);
  return n.length ? n.split(" ") : [];
}

/**
 * Longest Common Substring over two token arrays (contiguous, in order), via DP.
 * Returns the run length and the [start, end) span within array `a` (the true suffix).
 */
function longestCommonTokenRun(
  a: string[],
  b: string[],
): { length: number; aStart: number; aEnd: number } {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return { length: 0, aStart: 0, aEnd: 0 };

  // rolling DP rows to keep memory at O(m)
  let prev = new Array<number>(m + 1).fill(0);
  let best = 0;
  let bestAEnd = 0; // exclusive end index in `a`

  for (let i = 1; i <= n; i++) {
    const curr = new Array<number>(m + 1).fill(0);
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > best) {
          best = curr[j];
          bestAEnd = i; // i is 1-based end -> exclusive end index in 0-based
        }
      }
    }
    prev = curr;
  }

  return { length: best, aStart: bestAEnd - best, aEnd: bestAEnd };
}

/**
 * Leading exact match: starting from the first token of trueSuffix, find how many
 * consecutive opening tokens the model reproduced (the suffix's opening run located
 * anywhere inside the continuation).
 */
function leadingExactMatchCount(suffix: string[], cont: string[]): number {
  if (suffix.length === 0 || cont.length === 0) return 0;
  let best = 0;
  for (let start = 0; start < cont.length; start++) {
    if (cont[start] !== suffix[0]) continue;
    let k = 0;
    while (
      start + k < cont.length &&
      k < suffix.length &&
      cont[start + k] === suffix[k]
    ) {
      k++;
    }
    if (k > best) best = k;
    if (best === suffix.length) break;
  }
  return best;
}

export function scoreMemorization(
  trueSuffix: string,
  modelContinuation: string,
): MemorizationResult {
  const suffixTokens = tokenize(trueSuffix);
  const contTokens = tokenize(modelContinuation);
  const suffixTokenCount = suffixTokens.length;

  const run = longestCommonTokenRun(suffixTokens, contTokens);
  const leadingExactMatch = leadingExactMatchCount(suffixTokens, contTokens);

  const memorizationScore =
    suffixTokenCount === 0
      ? 0
      : Math.min(100, Math.round((100 * run.length) / suffixTokenCount));

  const label =
    memorizationScore >= 60
      ? "Strong memorization signal"
      : memorizationScore >= 25
        ? "Partial"
        : "No meaningful overlap";

  return {
    memorizationScore,
    label,
    longestRun: run.length,
    leadingExactMatch,
    suffixTokenCount,
    matchStart: run.aStart,
    matchEnd: run.aEnd,
  };
}

/**
 * Split text at a word boundary near the given percentage.
 * Returns { prefix, trueSuffix }.
 */
export function splitAtWordBoundary(
  text: string,
  splitPct: number,
): { prefix: string; trueSuffix: string } {
  const clamped = Math.min(90, Math.max(10, splitPct));
  const target = Math.floor((text.length * clamped) / 100);

  // walk to the nearest whitespace at/after target so we cut on a word boundary
  let idx = target;
  while (idx < text.length && !/\s/.test(text[idx])) idx++;
  // if we ran to the end, walk backward instead
  if (idx >= text.length) {
    idx = target;
    while (idx > 0 && !/\s/.test(text[idx])) idx--;
  }

  return {
    prefix: text.slice(0, idx).trimEnd(),
    trueSuffix: text.slice(idx).trimStart(),
  };
}

/**
 * Map the matched token span back onto the raw trueSuffix so the UI can highlight it.
 * We re-tokenize the raw suffix by whitespace (preserving original casing/words) and
 * return three slices: before, matched, after.
 */
export function highlightSpans(
  trueSuffix: string,
  matchStart: number,
  matchEnd: number,
): { before: string; matched: string; after: string } {
  // Split raw suffix into words while remembering separators is overkill;
  // token indices align with the normalized whitespace tokenization, which
  // corresponds 1:1 to whitespace-separated words in the raw text.
  const rawWords = trueSuffix.trim().length ? trueSuffix.trim().split(/\s+/) : [];
  if (matchEnd <= matchStart || rawWords.length === 0) {
    return { before: trueSuffix, matched: "", after: "" };
  }
  const before = rawWords.slice(0, matchStart).join(" ");
  const matched = rawWords.slice(matchStart, matchEnd).join(" ");
  const after = rawWords.slice(matchEnd).join(" ");
  return {
    before: before ? before + " " : "",
    matched,
    after: after ? " " + after : "",
  };
}
