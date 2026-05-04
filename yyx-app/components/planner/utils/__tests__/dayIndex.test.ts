import { todayDayIndex, todayLocalISO } from '@/components/planner/utils/dayIndex';

describe('todayDayIndex', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns Monday-based index for a Saturday', () => {
    // 2026-04-25 is a Saturday → Monday=0 convention puts Saturday at 5.
    jest.useFakeTimers().setSystemTime(new Date('2026-04-25T12:00:00'));
    expect(todayDayIndex()).toBe(5);
  });

  it('returns 0 for Monday', () => {
    // 2026-04-20 is a Monday.
    jest.useFakeTimers().setSystemTime(new Date('2026-04-20T12:00:00'));
    expect(todayDayIndex()).toBe(0);
  });

  it('returns 6 for Sunday', () => {
    // 2026-04-26 is a Sunday.
    jest.useFakeTimers().setSystemTime(new Date('2026-04-26T12:00:00'));
    expect(todayDayIndex()).toBe(6);
  });

  it('always returns a value in [0, 6]', () => {
    const v = todayDayIndex();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(6);
  });
});

describe('todayLocalISO', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns YYYY-MM-DD for the local date', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-25T12:00:00'));
    expect(todayLocalISO()).toBe('2026-04-25');
  });

  it('zero-pads single-digit months and days', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-05T08:00:00'));
    expect(todayLocalISO()).toBe('2026-01-05');
  });

  it('matches the YYYY-MM-DD shape', () => {
    expect(todayLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
