import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MeasurementSystem } from '@/types/user';
import { Storage } from '@/utils/storage';

type MeasurementContextType = {
  measurementSystem: MeasurementSystem;
  setMeasurementSystem: (system: MeasurementSystem) => Promise<void>;
};

const MeasurementContext = createContext<MeasurementContextType | undefined>(undefined);

export function MeasurementProvider({ children }: { children: React.ReactNode }) {
  const [measurementSystem, setMeasurementSystemState] = useState<MeasurementSystem>(MeasurementSystem.METRIC);

  useEffect(() => {
    Storage.getItem('measurementSystem')
      .then(saved => {
        if (saved) {
          setMeasurementSystemState(saved as MeasurementSystem);
        }
      });
  }, []);

  const setMeasurementSystem = useCallback(async (newMeasurementSystem: MeasurementSystem) => {
    setMeasurementSystemState(newMeasurementSystem);
    await Storage.setItem('measurementSystem', newMeasurementSystem);
  }, []);

  const value = useMemo<MeasurementContextType>(() => ({
    measurementSystem,
    setMeasurementSystem,
  }), [measurementSystem, setMeasurementSystem]);

  return (
    <MeasurementContext.Provider value={value}>
      {children}
    </MeasurementContext.Provider>
  );
}

export function useMeasurement() {
  const context = useContext(MeasurementContext);
  if (!context) {
    throw new Error('useMeasurement must be used within a MeasurementProvider');
  }
  return context;
}
