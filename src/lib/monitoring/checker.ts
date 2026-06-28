import { getProvider } from "@/lib/providers";
import { createServiceClient } from "@/lib/supabase/server";

export interface MonitorRow {
  id: string;
  user_id: string;
  brand_name: string;
  queries: string[];
  providers: string[];
}

export async function checkMonitor(monitor: MonitorRow): Promise<void> {
  const service = createServiceClient();

  for (const query of monitor.queries) {
    for (const providerId of monitor.providers) {
      const provider = getProvider(providerId);
      if (!provider || !provider.isConfigured()) continue;

      let responseText = "";
      try {
        responseText = await provider.complete({
          system: "You are a helpful assistant. Answer concisely.",
          user: `Tell me about ${query}`,
          temperature: 0,
          maxTokens: 512,
        });
      } catch {
        // Skip this provider/query combo on error — log non-fatally
        continue;
      }

      const mentioned = responseText
        .toLowerCase()
        .includes(monitor.brand_name.toLowerCase());

      // Extract surrounding context (up to 200 chars around mention)
      let context: string | null = null;
      if (mentioned) {
        const idx = responseText.toLowerCase().indexOf(monitor.brand_name.toLowerCase());
        const start = Math.max(0, idx - 80);
        const end = Math.min(responseText.length, idx + monitor.brand_name.length + 80);
        context = responseText.slice(start, end).trim();
      }

      await service.from("aeo_monitor_results").insert({
        monitor_id: monitor.id,
        provider: providerId,
        query,
        mentioned,
        context,
      });
    }
  }

  await service
    .from("aeo_monitors")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", monitor.id);
}
