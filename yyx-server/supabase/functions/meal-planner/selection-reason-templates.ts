/**
 * Deterministic, locale-aware templates for planner-generated user-facing copy.
 *
 * The planner produces short explanations (`selection_reason`) at generation
 * time. These must match the user's locale — Mexico is the primary market and
 * Spanish users must see Spanish text.
 *
 * No LLM generation. All text is static per locale; variables are interpolated
 * deterministically.
 */

export type SelectionReasonCode =
  | "busy_day_leftovers"
  | "busy_day_easy_pick"
  | "first_week_trust"
  | "leftovers_source"
  | "verified_fit"
  | "time_fit"
  | "default";

export interface SelectionReasonParams {
  dayLabel?: string;
  sourceTitle?: string;
}

type TemplateFn = (params: SelectionReasonParams) => string;

const SELECTION_REASON_TEMPLATES: Record<
  string,
  Record<SelectionReasonCode, TemplateFn>
> = {
  en: {
    busy_day_leftovers: ({ sourceTitle = "yesterday's meal", dayLabel = "" }) =>
      `Uses leftovers from ${sourceTitle} so you don't need to cook on ${dayLabel}.`
        .replace(/\s+\./, ".")
        .trim(),
    busy_day_easy_pick: ({ dayLabel = "" }) =>
      `Quick, easy pick for your busy ${dayLabel}.`.replace(/\s+\./, ".")
        .trim(),
    first_week_trust: () =>
      `Reliable family-friendly pick for your first week.`,
    leftovers_source: () => `Makes enough to help cover later in the week.`,
    verified_fit: ({ dayLabel = "" }) =>
      `YummyYummix-tested recipe that fits your ${dayLabel}.`.replace(
        /\s+\./,
        ".",
      ).trim(),
    time_fit: ({ dayLabel = "" }) =>
      `Fits your usual ${dayLabel} time window.`.replace(/\s+\./, ".").trim(),
    default: ({ dayLabel = "" }) =>
      `Good fit for your ${dayLabel}.`.replace(/\s+\./, ".").trim(),
  },
  es: {
    busy_day_leftovers: (
      { sourceTitle = "la comida de ayer", dayLabel = "" },
    ) =>
      `Aprovecha las sobras de ${sourceTitle} y no tendrás que cocinar el ${dayLabel}.`
        .replace(/\s+\./, ".")
        .trim(),
    busy_day_easy_pick: ({ dayLabel = "" }) =>
      `Opción rápida y fácil para tu ${dayLabel} ocupado.`.replace(
        /\s+\./,
        ".",
      ).trim(),
    first_week_trust: () =>
      `Opción confiable y familiar para tu primera semana.`,
    leftovers_source: () =>
      `Hace suficiente para cubrir más adelante en la semana.`,
    verified_fit: ({ dayLabel = "" }) =>
      `Receta probada por YummyYummix que encaja con tu ${dayLabel}.`.replace(
        /\s+\./,
        ".",
      ).trim(),
    time_fit: ({ dayLabel = "" }) =>
      `Se adapta a tu horario de ${dayLabel}.`.replace(/\s+\./, ".").trim(),
    default: ({ dayLabel = "" }) =>
      `Buena opción para tu ${dayLabel}.`.replace(/\s+\./, ".").trim(),
  },
};

const DAY_LABELS: Record<string, string[]> = {
  en: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ],
  es: [
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
    "domingo",
  ],
};

function pickLanguage(locale: string): "en" | "es" {
  return locale.toLowerCase().startsWith("es") ? "es" : "en";
}

export function renderSelectionReason(
  code: SelectionReasonCode,
  locale: string,
  params: SelectionReasonParams = {},
): string {
  const lang = pickLanguage(locale);
  const template = SELECTION_REASON_TEMPLATES[lang]?.[code] ??
    SELECTION_REASON_TEMPLATES.en[code];
  return template(params);
}

export function getDayLabel(dayIndex: number, locale: string): string {
  const lang = pickLanguage(locale);
  return DAY_LABELS[lang]?.[dayIndex] ?? DAY_LABELS.en[dayIndex] ??
    `day ${dayIndex}`;
}
