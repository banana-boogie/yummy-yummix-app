import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const DEFAULT_MONTHLY_GENERATION_LIMIT = Number(
  Deno.env.get("AI_MONTHLY_GENERATION_LIMIT") ?? "120",
);

const WARNING_80_FRACTION = 0.8;
const WARNING_90_FRACTION = 0.9;

interface GenerationUsageRow {
  generation_count: number;
  warning_80_sent_at: string | null;
  warning_90_sent_at: string | null;
}

export interface GenerationBudgetStatus {
  allowed: boolean;
  used: number;
  limit: number;
  resetAt: string;
}

export interface GenerationUsageUpdate extends GenerationBudgetStatus {
  warningLevel?: 80 | 90;
  warningMessage?: string;
}

function getMonthStart(date = new Date()): string {
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return monthStart.toISOString().slice(0, 10);
}

function getNextMonthStart(monthStart: string): string {
  const current = new Date(`${monthStart}T00:00:00.000Z`);
  const next = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1),
  );
  return next.toISOString().slice(0, 10);
}

function formatResetDate(resetAt: string, language: "en" | "es"): string {
  const formatter = new Intl.DateTimeFormat(
    language === "es" ? "es-MX" : "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    },
  );
  return formatter.format(new Date(`${resetAt}T00:00:00.000Z`));
}

function buildWarningMessage(
  language: "en" | "es",
  used: number,
  limit: number,
  resetAt: string,
  warningLevel: 80 | 90,
): string {
  const resetDate = formatResetDate(resetAt, language);
  return language === "es"
    ? `Aviso: has usado ${used} de ${limit} creaciones de recetas este mes (${warningLevel}%). Se reinicia el ${resetDate}.`
    : `Heads up: you've used ${used} of ${limit} recipe creations this month (${warningLevel}%). It resets on ${resetDate}.`;
}

export function buildGenerationBudgetExceededMessage(
  language: "en" | "es",
  resetAt: string,
): string {
  const resetDate = formatResetDate(resetAt, language);
  return language === "es"
    ? `Alcanzaste tu límite mensual de creaciones de recetas. Se reinicia el ${resetDate}. Mientras tanto, puedo ayudarte a buscar recetas existentes.`
    : `You've reached your monthly recipe creation limit. It resets on ${resetDate}. In the meantime, I can still help you search existing recipes.`;
}

async function getUsageRow(
  supabase: SupabaseClient,
  userId: string,
  monthStart: string,
): Promise<GenerationUsageRow | null> {
  const { data, error } = await supabase
    .from("ai_monthly_generation_usage")
    .select("generation_count, warning_80_sent_at, warning_90_sent_at")
    .eq("user_id", userId)
    .eq("month_start", monthStart)
    .maybeSingle();

  if (error) {
    console.warn("[generation-budget] Failed reading usage row", {
      message: error.message,
    });
    return null;
  }

  return (data as GenerationUsageRow | null) ?? null;
}

export async function checkGenerationBudget(
  supabase: SupabaseClient,
  userId: string,
  limit = DEFAULT_MONTHLY_GENERATION_LIMIT,
): Promise<GenerationBudgetStatus> {
  const monthStart = getMonthStart();
  const resetAt = getNextMonthStart(monthStart);
  const row = await getUsageRow(supabase, userId, monthStart);
  const used = row?.generation_count ?? 0;

  return {
    allowed: used < limit,
    used,
    limit,
    resetAt,
  };
}

export async function recordGenerationUsage(
  supabase: SupabaseClient,
  userId: string,
  language: "en" | "es",
  limit = DEFAULT_MONTHLY_GENERATION_LIMIT,
): Promise<GenerationUsageUpdate> {
  const monthStart = getMonthStart();
  const resetAt = getNextMonthStart(monthStart);
  const row = await getUsageRow(supabase, userId, monthStart);
  const used = row?.generation_count ?? 0;

  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      resetAt,
      warningMessage: buildGenerationBudgetExceededMessage(language, resetAt),
    };
  }

  const nextUsed = used + 1;
  const nowIso = new Date().toISOString();
  const warning80Threshold = Math.ceil(limit * WARNING_80_FRACTION);
  const warning90Threshold = Math.ceil(limit * WARNING_90_FRACTION);

  let warningLevel: 80 | 90 | undefined;
  const upsertPayload: Record<string, unknown> = {
    user_id: userId,
    month_start: monthStart,
    generation_count: nextUsed,
    updated_at: nowIso,
  };

  if (nextUsed >= warning90Threshold && !row?.warning_90_sent_at) {
    warningLevel = 90;
    upsertPayload.warning_90_sent_at = nowIso;
  } else if (nextUsed >= warning80Threshold && !row?.warning_80_sent_at) {
    warningLevel = 80;
    upsertPayload.warning_80_sent_at = nowIso;
  }

  const { error } = await supabase
    .from("ai_monthly_generation_usage")
    .upsert(upsertPayload, { onConflict: "user_id,month_start" });

  if (error) {
    console.warn("[generation-budget] Failed persisting usage row", {
      message: error.message,
    });
  }

  return {
    allowed: true,
    used: nextUsed,
    limit,
    resetAt,
    warningLevel,
    warningMessage: warningLevel
      ? buildWarningMessage(language, nextUsed, limit, resetAt, warningLevel)
      : undefined,
  };
}
