import { createServiceClient } from "@/lib/supabase/server";

const WINDOW_MS = 60_000; // 1 минута
const MAX_PER_WINDOW = 10;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

export async function checkRateLimit(
  userId: string,
  endpoint: string
): Promise<RateLimitResult> {
  const supabase = createServiceClient();
  const windowStart = new Date(
    Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS
  ).toISOString();

  // Upsert: если запись есть — увеличиваем счётчик, если нет — создаём
  const { data, error } = await supabase.rpc("increment_rate_limit", {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_window_start: windowStart,
    p_max: MAX_PER_WINDOW,
  });

  if (error) {
    // При ошибке БД пропускаем запрос (fail open) — лучше чем блокировать всех
    console.error("[rate-limit] DB error (fail open):", error.message);
    return { ok: true };
  }

  if (data === false) {
    const nextWindow = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS + WINDOW_MS;
    return { ok: false, retryAfterMs: nextWindow - Date.now() };
  }

  return { ok: true };
}
