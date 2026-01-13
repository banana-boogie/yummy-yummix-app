// NOTE: The error codes are from the Supabase Auth API.
// https://supabase.com/docs/guides/auth/debugging/error-codes

export enum AuthErrorKey {
  InvalidEmail = 'invalidEmail',
  EmailInUse = 'emailInUse',
  InvalidCredentials = 'invalidCredentials',
  TooManyAttempts = 'tooManyAttempts',
  Default = 'default',
  OTPExpired = 'otp_expired'
}

export const getAuthErrorKey = (code?: string): AuthErrorKey => {
  if (!code) return AuthErrorKey.Default;

  switch (code) {
    case 'over_email_send_rate_limit':
    case 'too_many_requests':
      return AuthErrorKey.TooManyAttempts;
    case 'validation_failed':
    case 'invalid_email':
      return AuthErrorKey.InvalidEmail;
    case 'user_already_exists':
    case 'email_in_use':
      return AuthErrorKey.EmailInUse;
    case 'invalid_credentials':
    case 'invalid_grant':
    case 'otp_expired':
      return AuthErrorKey.InvalidCredentials;
    default:
      return AuthErrorKey.Default;
  }
}; 