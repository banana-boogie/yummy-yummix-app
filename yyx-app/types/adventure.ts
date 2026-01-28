export type AdventureRegionId =
  | 'foundations'
  | 'americas'
  | 'europe'
  | 'asia'
  | 'africa'
  | 'oceania';

export type AdventureLevelType = 'guided' | 'technique' | 'challenge';

export interface AdventureCourse {
  id: string;
  regionId: AdventureRegionId;
  titleKey: string;
  descriptionKey: string;
  isPlayable: boolean;
  levelIds: string[];
}

export interface AdventureLevel {
  id: string;
  courseId: string;
  titleKey: string;
  descriptionKey: string;
  type: AdventureLevelType;
  durationMinutes: number;
  xpReward: number;
  coinReward: number;
  prerequisites: string[];
  isPlayable: boolean;
  stepKeys?: string[];
}

export interface AdventureRegion {
  id: AdventureRegionId;
  titleKey: string;
  descriptionKey: string;
  courseIds: string[];
}

export interface AdventureProgress {
  completedLevelIds: string[];
  unlockedLevelIds: string[];
  totalXp: number;
  totalCoins: number;
  streak: {
    current: number;
    lastActiveDate: string | null;
  };
}

export type LevelStatus = 'locked' | 'unlocked' | 'completed';
