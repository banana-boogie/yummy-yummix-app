import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getDayLabel,
  renderSelectionReason,
} from "./selection-reason-templates.ts";

Deno.test("renderSelectionReason: busy_day_leftovers in English", () => {
  const text = renderSelectionReason("busy_day_leftovers", "en", {
    dayLabel: "Tuesday",
    sourceTitle: "Pot roast",
  });
  assertStringIncludes(text, "leftovers");
  assertStringIncludes(text, "Pot roast");
  assertStringIncludes(text, "Tuesday");
});

Deno.test("renderSelectionReason: busy_day_leftovers in Spanish uses recalentado framing", () => {
  const text = renderSelectionReason("busy_day_leftovers", "es", {
    dayLabel: "martes",
    sourceTitle: "Pollo asado",
  });
  assertStringIncludes(text, "Recalentado");
  assertStringIncludes(text, "Pollo asado");
  assertStringIncludes(text, "martes");
});

Deno.test("renderSelectionReason: es-MX resolves to Spanish templates", () => {
  const text = renderSelectionReason("busy_day_easy_pick", "es-MX", {
    dayLabel: "miércoles",
  });
  assertStringIncludes(text, "rápida");
  assertStringIncludes(text, "miércoles");
});

Deno.test("renderSelectionReason: busy_day_easy_pick in English", () => {
  const text = renderSelectionReason("busy_day_easy_pick", "en", {
    dayLabel: "Tuesday",
  });
  assertStringIncludes(text, "Quick");
  assertStringIncludes(text, "Tuesday");
});

Deno.test("renderSelectionReason: unknown locale falls back to English", () => {
  const text = renderSelectionReason("first_week_trust", "fr", {});
  assertStringIncludes(text.toLowerCase(), "first week");
});

Deno.test("renderSelectionReason: first_week_trust is locale-specific", () => {
  const en = renderSelectionReason("first_week_trust", "en", {});
  const es = renderSelectionReason("first_week_trust", "es", {});
  if (en === es) {
    throw new Error("English and Spanish first_week_trust copy should differ");
  }
  assertStringIncludes(es, "primera semana");
});

Deno.test("renderSelectionReason: swap_alternative_verified is locale-specific", () => {
  const en = renderSelectionReason("swap_alternative_verified", "en", {});
  const es = renderSelectionReason("swap_alternative_verified", "es", {});
  assertStringIncludes(en, "YummyYummix-tested");
  assertStringIncludes(es, "Receta probada");
  if (en === es) {
    throw new Error("EN and ES swap_alternative_verified copy should differ");
  }
});

Deno.test("renderSelectionReason: swap_alternative_quick is locale-specific", () => {
  const en = renderSelectionReason("swap_alternative_quick", "en", {});
  const es = renderSelectionReason("swap_alternative_quick", "es-MX", {});
  assertStringIncludes(en, "Quick");
  assertStringIncludes(es, "rápida");
});

Deno.test("renderSelectionReason: swap_applied is locale-specific", () => {
  const en = renderSelectionReason("swap_applied", "en", {});
  const es = renderSelectionReason("swap_applied", "es", {});
  assertEquals(en, "Applied.");
  assertEquals(es, "Aplicado.");
});

Deno.test("getDayLabel: English labels", () => {
  assertEquals(getDayLabel(0, "en"), "Monday");
  assertEquals(getDayLabel(6, "en"), "Sunday");
});

Deno.test("getDayLabel: Spanish labels", () => {
  assertEquals(getDayLabel(0, "es"), "lunes");
  assertEquals(getDayLabel(2, "es-MX"), "miércoles");
  assertEquals(getDayLabel(6, "es"), "domingo");
});

Deno.test("getDayLabel: out-of-range index returns fallback", () => {
  assertEquals(getDayLabel(10, "en"), "day 10");
});
