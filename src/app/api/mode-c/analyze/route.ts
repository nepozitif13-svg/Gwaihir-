import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getProvider } from "@/lib/providers";
import { parseUrl, SsrfError } from "@/lib/aeo/parser";
import { runAudit } from "@/lib/aeo/auditor";
import { generateFaq } from "@/lib/aeo/generators/faq";
import { generateSchema } from "@/lib/aeo/generators/schema";
import { generateLlmsTxt } from "@/lib/aeo/generators/llms";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RequestSchema = z.object({
  url: z.string().url().max(2048),
  queries: z.array(z.string().min(1).max(200)).min(1).max(10),
  competitors: z.array(z.string().max(200)).max(5).default([]),
  providerId: z.string().min(1).max(50),
  siteName: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(500).optional(),
});

function sse(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
}

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // Rate limit
  const rl = await checkRateLimit(user.id, "mode-c");
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  // Validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const { url, queries, competitors, providerId, siteName, description } = parsed.data;

  const provider = getProvider(providerId);
  if (!provider || !provider.isConfigured()) {
    return new Response(JSON.stringify({ error: "Provider not available" }), { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: parse URL
        sse(controller, "progress", { step: "fetch", message: "Fetching and parsing page..." });
        let content: string;
        try {
          content = await parseUrl(url);
        } catch (err) {
          sse(controller, "error", {
            message: err instanceof SsrfError ? err.message : "Failed to fetch URL",
          });
          controller.close();
          return;
        }

        // Step 2: audit
        sse(controller, "progress", { step: "audit", message: "Running AEO audit..." });
        const audit = await runAudit(content, queries, competitors, provider);
        sse(controller, "audit", audit);

        // Step 3: FAQ
        sse(controller, "progress", { step: "faq", message: "Generating FAQ blocks..." });
        const faqs = await generateFaq(content, queries, provider);
        sse(controller, "faq", faqs);

        // Step 4: Schema
        sse(controller, "progress", { step: "schema", message: "Generating JSON-LD schema..." });
        const schema = await generateSchema(faqs, url, provider);
        sse(controller, "schema", { json: schema });

        // Step 5: llms.txt
        sse(controller, "progress", { step: "llms", message: "Generating llms.txt..." });
        const llmsTxt = generateLlmsTxt({
          siteName: siteName ?? new URL(url).hostname,
          description: description ?? queries[0],
          queries,
          faqs,
        });
        sse(controller, "llms", { text: llmsTxt });

        // Save to DB (non-fatal)
        try {
          const service = createServiceClient();
          await service.from("aeo_analyses").insert({
            user_id: user.id,
            url,
            queries,
            competitors,
            provider: providerId,
            audit_score: audit.score,
            audit_label: audit.label,
            audit_dimensions: audit.dimensions,
            recommendations: audit.recommendations,
            faqs,
            schema_json: schema,
            llms_txt: llmsTxt,
          });
        } catch {
          // non-fatal
        }

        sse(controller, "done", { message: "Analysis complete" });
      } catch (err: unknown) {
        sse(controller, "error", {
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
