const DAY_MS = 24 * 60 * 60 * 1000;

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getDateKeyOffset = (offsetDays: number) => {
  const date = new Date(Date.now() + offsetDays * DAY_MS);
  return toDateKey(date);
};

export const getUpdatedStreak = (currentStreak: number, lastActiveDate: string | null) => {
  const todayKey = getDateKeyOffset(0);
  const yesterdayKey = getDateKeyOffset(-1);

  if (lastActiveDate === todayKey) {
    return { current: currentStreak, lastActiveDate: todayKey };
  }

  if (lastActiveDate === yesterdayKey) {
    return { current: currentStreak + 1, lastActiveDate: todayKey };
  }

  return { current: 1, lastActiveDate: todayKey };
};
