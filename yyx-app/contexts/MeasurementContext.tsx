import { createContext, useContext, useEffect, useState } from 'react';
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

  const setMeasurementSystem = async (newMeasurementSystem: MeasurementSystem) => {
    setMeasurementSystemState(newMeasurementSystem);
    await Storage.setItem('measurementSystem', newMeasurementSystem);
  };

  return (
    <MeasurementContext.Provider value={{ measurementSystem, setMeasurementSystem }}>
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