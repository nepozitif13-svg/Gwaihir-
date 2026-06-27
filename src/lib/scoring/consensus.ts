// Mode B scoring — cluster claims across providers and flag consensus vs contested.

export interface RawClaim {
  subject: string;
  attribute: string;
  value: string;
  provider: string;
}

export interface ClaimCluster {
  subject: string;
  attribute: string;
  value: string; // representative value (first seen)
  providers: string[]; // distinct providers
  distinctProviderCount: number;
  status: "consensus" | "contested";
}

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Dice coefficient over character bigrams.
export function diceSimilarity(a: string, b: string): number {
  const A = norm(a);
  const B = norm(b);
  if (A === B) return 1;
  if (A.length < 2 || B.length < 2) return 0;

  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const ma = bigrams(A);
  const mb = bigrams(B);
  let overlap = 0;
  let total = 0;
  ma.forEach((countA, g) => {
    total += countA;
    const countB = mb.get(g);
    if (countB) overlap += Math.min(countA, countB);
  });
  mb.forEach((countB) => {
    total += countB;
  });
  return total === 0 ? 0 : (2 * overlap) / total;
}

const VALUE_SIM_THRESHOLD = 0.8;

export function clusterClaims(claims: RawClaim[]): ClaimCluster[] {
  const clusters: {
    subject: string;
    attribute: string;
    value: string;
    key: string;
    valueNorm: string;
    providers: Set<string>;
  }[] = [];

  for (const c of claims) {
    if (!c || (!c.subject && !c.attribute && !c.value)) continue;
    const key = `${norm(c.subject)}|${norm(c.attribute)}`;
    const valueNorm = norm(c.value);

    // find an existing cluster with the same subject|attribute key AND similar value
    const match = clusters.find(
      (cl) =>
        cl.key === key &&
        (cl.valueNorm === valueNorm ||
          diceSimilarity(cl.valueNorm, valueNorm) >= VALUE_SIM_THRESHOLD),
    );

    if (match) {
      match.providers.add(c.provider);
    } else {
      clusters.push({
        subject: c.subject,
        attribute: c.attribute,
        value: c.value,
        key,
        valueNorm,
        providers: new Set([c.provider]),
      });
    }
  }

  const result: ClaimCluster[] = clusters.map((cl) => {
    const providers = Array.from(cl.providers);
    return {
      subject: cl.subject,
      attribute: cl.attribute,
      value: cl.value,
      providers,
      distinctProviderCount: providers.length,
      status: providers.length >= 2 ? "consensus" : "contested",
    };
  });

  // consensus first, then by provider count desc
  result.sort((a, b) => {
    if (a.status !== b.status) return a.status === "consensus" ? -1 : 1;
    return b.distinctProviderCount - a.distinctProviderCount;
  });

  return result;
}

export interface ShareOfVoiceEntry {
  name: string;
  mentions: number; // distinct providers mentioning it
}

// Tally named alternatives by how many distinct providers mention each.
export function tallyShareOfVoice(
  perProviderNames: { provider: string; names: string[] }[],
): ShareOfVoiceEntry[] {
  const byName = new Map<string, { display: string; providers: Set<string> }>();
  for (const { provider, names } of perProviderNames) {
    for (const raw of names) {
      const name = raw.trim();
      if (!name) continue;
      const k = norm(name);
      if (!k) continue;
      if (!byName.has(k)) byName.set(k, { display: name, providers: new Set() });
      byName.get(k)!.providers.add(provider);
    }
  }
  return Array.from(byName.values())
    .map((v) => ({ name: v.display, mentions: v.providers.size }))
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
}
