# Gwaihir

Gwaihir reads the **model layer** — the language models through which the world
now learns about companies, products, and people — from two sides, over one
probe-and-score engine. **Mode A (Memorization Audit)** takes a known text,
sends a prefix to a model, asks it to continue, and measures how much of the
true continuation it reproduces verbatim — high overlap is evidence the model
memorized the text from training (copyright / training-data-leakage / privacy
angle). **Mode B (Model-Layer Recon)** takes a public target, fans out an
8-question battery to several models, extracts atomic claims from each answer,
and cross-checks them: claims many models agree on are treated as grounded
public facts, claims that diverge are flagged as likely hallucinations — output
is a dossier (claims, sentiment, share of voice).

## Setup

```bash
npm install                 # also runs `prisma generate`
cp .env.local.example .env.local   # then add at least one provider key
npm run db:push             # create the SQLite schema (prisma/dev.db)
npm run dev                 # http://localhost:3000
```

## Environment variables

All model calls happen **server-side only**; keys never reach the client bundle.

| Variable             | Required          | Purpose                          |
| -------------------- | ----------------- | -------------------------------- |
| `ANTHROPIC_API_KEY`  | at least one of   | Claude (Anthropic)               |
| `OPENAI_API_KEY`     | these four        | GPT (OpenAI)                     |
| `GOOGLE_API_KEY`     | must be set       | Gemini (Google)                  |
| `PERPLEXITY_API_KEY` |                   | Perplexity                       |
| `DATABASE_URL`       | yes (`file:./dev.db`) | SQLite location for run history |

A provider is used only if its key is present; missing providers are silently
skipped. `GET /api/health` reports which are configured.

**Mode B needs ≥ 2 providers to be meaningful** — cross-checking is the whole
point, so with a single provider every claim is flagged `contested` and the UI
warns you.

Model IDs live in [`src/lib/config/models.ts`](src/lib/config/models.ts) — swap
them in one place.

## Scope (white-hat)

Gwaihir is a defensive, research, and analysis tool. Mode A audits your own
data and copyright. Mode B does open-source recon on public entities and
analyzes representation. **It audits public information and model behavior; it
does not extract private data; Mode B targets public entities only.** It does
not scrape private/authenticated sources, and it does not present contested
(possibly hallucinated) claims as fact — that is what the cross-check is for.

## v0 limits

No auth, no accounts, no payments, no PDF export, no charts, no websockets —
a single-user local web app. All probes run at temperature 0 for determinism.
