import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const FALLBACK_QUOTA_MINUTES = 30;

export function getDefaultVoiceQuotaMinutes(): number {
  const rawValue = Deno.env.get("DEFAULT_VOICE_QUOTA_MINUTES") || "30";
  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return FALLBACK_QUOTA_MINUTES;
  }

  return parsedValue;
}

export async function getQuotaLimitForUser(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  defaultQuotaMinutes: number = getDefaultVoiceQuotaMinutes(),
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("voice_quotas")
      .select("monthly_minutes_limit, expires_at")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return defaultQuotaMinutes;
    }

    const quotaLimit = Number(data.monthly_minutes_limit);
    if (!Number.isFinite(quotaLimit) || quotaLimit <= 0) {
      return defaultQuotaMinutes;
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return defaultQuotaMinutes;
    }

    return quotaLimit;
  } catch {
    return defaultQuotaMinutes;
  }
}
