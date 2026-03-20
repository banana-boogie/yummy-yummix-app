import { useState, useCallback } from 'react';
import type { ToastConfig } from '@/components/common/Toast';

export function useToast() {
  const [toast, setToast] = useState<ToastConfig | null>(null);

  const showToast = useCallback((config: ToastConfig) => {
    setToast(config);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, dismissToast };
}
