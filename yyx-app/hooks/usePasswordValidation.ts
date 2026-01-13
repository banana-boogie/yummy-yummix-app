import { useState, useEffect } from 'react';

interface PasswordValidation {
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  isValid: boolean;
}

export function usePasswordValidation(password: string): PasswordValidation {
  const [validation, setValidation] = useState<PasswordValidation>({
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSymbol: false,
    isValid: false,
  });

  useEffect(() => {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const isValid = hasUppercase && hasLowercase && hasNumber;

    setValidation({
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSymbol,
      isValid,
    });
  }, [password]);

  return validation;
} 