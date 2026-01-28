import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AdventureProgress } from '@/types/adventure';
import { getAdventureLevelById, getCourseLevels } from '@/data/adventure';
import { getUpdatedStreak } from '@/utils/adventure/streak';

interface AdventureContextValue {
  progress: AdventureProgress;
  completeLevel: (courseId: string, levelId: string) => void;
}

const AdventureContext = createContext<AdventureContextValue | undefined>(undefined);

const initialProgress: AdventureProgress = {
  completedLevelIds: [],
  unlockedLevelIds: ['basics-1'],
  totalXp: 0,
  totalCoins: 0,
  streak: {
    current: 0,
    lastActiveDate: null,
  },
};

export function AdventureProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<AdventureProgress>(initialProgress);

  const completeLevel = useCallback((courseId: string, levelId: string) => {
    setProgress((current) => {
      if (current.completedLevelIds.includes(levelId)) {
        return current;
      }

      const level = getAdventureLevelById(levelId);
      const updatedStreak = getUpdatedStreak(current.streak.current, current.streak.lastActiveDate);

      const updatedCompleted = [...current.completedLevelIds, levelId];
      const updatedUnlocked = new Set(current.unlockedLevelIds);
      updatedUnlocked.add(levelId);

      const courseLevels = getCourseLevels(courseId);
      const currentIndex = courseLevels.findIndex((entry) => entry.id === levelId);
      if (currentIndex >= 0) {
        const nextLevel = courseLevels[currentIndex + 1];
        if (nextLevel) {
          updatedUnlocked.add(nextLevel.id);
        }
      }

      return {
        ...current,
        completedLevelIds: updatedCompleted,
        unlockedLevelIds: Array.from(updatedUnlocked),
        totalXp: current.totalXp + (level?.xpReward ?? 0),
        totalCoins: current.totalCoins + (level?.coinReward ?? 0),
        streak: updatedStreak,
      };
    });
  }, []);

  const value = useMemo(() => ({ progress, completeLevel }), [progress, completeLevel]);

  return (
    <AdventureContext.Provider value={value}>
      {children}
    </AdventureContext.Provider>
  );
}

export const useAdventure = () => {
  const context = useContext(AdventureContext);
  if (!context) {
    throw new Error('useAdventure must be used within AdventureProvider');
  }
  return context;
};
