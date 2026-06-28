import { createServiceClient } from "@/lib/supabase/server";

export async function saveRunSafe(args: {
  userId: string;
  mode: "A" | "B";
  input: string;
  config: unknown;
  results: unknown;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("runs").insert({
      user_id: args.userId,
      mode: args.mode,
      input: args.input,
      config: args.config ?? {},
      results: args.results ?? {},
    });
  } catch (err) {
    console.error("[gwaihir] saveRunSafe failed (non-fatal):", err);
  }
}
