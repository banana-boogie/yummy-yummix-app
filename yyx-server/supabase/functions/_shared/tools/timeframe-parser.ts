export interface TimeframeRange {
  after: Date;
  before: Date;
}

/**
 * Parse a natural-language timeframe into a Date range.
 * Returns null when timeframe is not recognized.
 */
export function parseNaturalLanguageTimeframe(
  timeframe: string,
): TimeframeRange | null {
  const now = new Date();
  const lower = timeframe.toLowerCase().trim();

  // Relative references
  if (/yesterday/i.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { after: d, before: end };
  }

  if (/last\s+week/i.test(lower)) {
    const end = new Date(now);
    end.setDate(end.getDate() - ((end.getDay() + 6) % 7)); // Start of this week
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return { after: start, before: end };
  }

  if (/this\s+week/i.test(lower)) {
    const start = new Date(now);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    return { after: start, before: now };
  }

  if (/last\s+month/i.test(lower)) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { after: start, before: end };
  }

  // Days ago pattern: "2 days ago"
  const daysMatch = lower.match(/(\d+)\s*days?\s*ago/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (days > 0 && days <= 365) {
      const start = new Date(now);
      start.setDate(start.getDate() - days - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(end.getDate() - days + 1);
      end.setHours(23, 59, 59, 999);
      return { after: start, before: end };
    }
  }

  // Month name: English + Spanish
  const months: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
  };

  for (const [name, idx] of Object.entries(months)) {
    if (lower.includes(name)) {
      let year = now.getFullYear();
      if (idx > now.getMonth()) year--; // Assume previous year if month is in the future
      const start = new Date(year, idx, 1);
      const end = new Date(year, idx + 1, 0, 23, 59, 59, 999);
      return { after: start, before: end };
    }
  }

  return null;
}
