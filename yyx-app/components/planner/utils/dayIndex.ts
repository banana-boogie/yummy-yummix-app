/**
 * Date helpers for the planner UI.
 *
 * Both functions resolve "today" against the device's local timezone, which is
 * what the planner UI cares about — a user in Mexico City at 11pm sees today's
 * meals, not tomorrow's. Avoid `toISOString()` for date-only strings; that
 * returns UTC and crosses the midnight boundary in non-UTC timezones.
 */

/**
 * Today's day index using the local timezone, with Monday = 0.
 *
 * Matches the meal-slot-schema convention used server-side and in stored slot
 * data (`MealPlanSlotResponse.dayIndex`).
 */
export function todayDayIndex(): number {
  const day = new Date().getDay(); // 0 = Sunday … 6 = Saturday
  return (day + 6) % 7; // Monday = 0 … Sunday = 6
}

/**
 * Local-timezone YYYY-MM-DD string for "today".
 *
 * Do NOT use `toISOString()` — that's UTC and shifts the calendar day for users
 * in negative-offset timezones during the late-evening hours.
 */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
