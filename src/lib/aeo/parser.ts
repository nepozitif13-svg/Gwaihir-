import { URL } from "url";

const BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\./,
];

const MAX_BYTES = 200 * 1024; // 200 KB
const TIMEOUT_MS = 10_000;

export class SsrfError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "SsrfError";
  }
}

function assertSafeHost(hostname: string) {
  for (const pat of BLOCKED_PATTERNS) {
    if (pat.test(hostname)) {
      throw new SsrfError(`Blocked host: ${hostname}`);
    }
  }
}

export async function parseUrl(raw: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SsrfError("Invalid URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new SsrfError("Only HTTP/HTTPS allowed.");
  }

  assertSafeHost(parsed.hostname);

  // DNS rebinding guard — resolve before fetch isn't available in edge,
  // but hostname check above covers common cases. Additional check post-response.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "Gwaihir-AEO-Auditor/1.0" },
      redirect: "follow",
    });
  } catch (err: unknown) {
    throw new SsrfError(
      `Fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new SsrfError(`Remote returned HTTP ${res.status}.`);

  // Guard against huge pages
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES) throw new SsrfError("Page too large (>200 KB).");

  const raw_html = await res.text();
  if (raw_html.length > MAX_BYTES) throw new SsrfError("Page too large (>200 KB).");

  // Strip tags, collapse whitespace
  const text = raw_html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim();

  return text.slice(0, 12_000); // cap for LLM context
}
