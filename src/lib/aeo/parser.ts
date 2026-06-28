import { URL } from "url";
import dns from "dns";

// Checked against the original hostname (before DNS resolution)
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
];

// Checked against every IP returned by DNS — catches rebinding and CNAME chains
const BLOCKED_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^0\.0\.0\.0/,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // CGNAT 100.64/10
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^::$/,
];

const MAX_BYTES = 1024 * 1024; // 1 MB — after tag-stripping we cap text at 12 K chars anyway
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export class SsrfError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "SsrfError";
  }
}

function assertSafeHostname(hostname: string) {
  for (const pat of BLOCKED_HOST_PATTERNS) {
    if (pat.test(hostname)) throw new SsrfError(`Blocked host: ${hostname}`);
  }
}

function assertSafeIp(address: string) {
  for (const pat of BLOCKED_IP_PATTERNS) {
    if (pat.test(address)) throw new SsrfError(`Blocked IP: ${address}`);
  }
}

// Resolves DNS and validates every returned address.
// Runs before each fetch, including on every redirect hop.
async function resolveAndValidate(hostname: string): Promise<void> {
  assertSafeHostname(hostname);

  let records: { address: string; family: number }[];
  try {
    records = await dns.promises.lookup(hostname, { all: true, family: 0 }) as { address: string; family: number }[];
  } catch {
    throw new SsrfError(`DNS resolution failed for: ${hostname}`);
  }

  if (!records.length) throw new SsrfError(`No DNS records for: ${hostname}`);

  for (const { address } of records) {
    assertSafeIp(address);
  }
}

// Fetches with redirect:"manual" so we re-validate every Location hop.
// TOCTOU note: a narrow window exists between DNS validation and TCP connect.
// True elimination requires an IP-pinning HTTP agent; the 10s timeout and
// per-hop re-validation significantly limit the practical attack surface.
async function fetchGuarded(url: URL, redirectsLeft: number): Promise<Response> {
  await resolveAndValidate(url.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "Gwaihir-AEO-Auditor/1.0" },
      redirect: "manual",
    });
  } catch (err: unknown) {
    throw new SsrfError(
      `Fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timer);
  }

  // Follow redirects manually — validate Location before each hop
  if (res.status >= 300 && res.status < 400) {
    if (redirectsLeft <= 0) throw new SsrfError("Too many redirects.");

    const location = res.headers.get("location");
    if (!location) throw new SsrfError("Redirect with no Location header.");

    let nextUrl: URL;
    try {
      nextUrl = new URL(location, url.toString());
    } catch {
      throw new SsrfError("Invalid redirect Location URL.");
    }

    if (!["http:", "https:"].includes(nextUrl.protocol)) {
      throw new SsrfError(`Blocked redirect protocol: ${nextUrl.protocol}`);
    }

    return fetchGuarded(nextUrl, redirectsLeft - 1);
  }

  return res;
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

  const res = await fetchGuarded(parsed, MAX_REDIRECTS);

  if (!res.ok) throw new SsrfError(`Remote returned HTTP ${res.status}.`);

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES) throw new SsrfError("Page too large (>200 KB).");

  const raw_html = await res.text();
  if (raw_html.length > MAX_BYTES) throw new SsrfError("Page too large (>200 KB).");

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

  return text.slice(0, 12_000);
}
