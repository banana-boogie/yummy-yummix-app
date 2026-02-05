export const auth = {
  processing: "Processing authentication...",
  common: {
    haveAccount: "Already have an account?",
    login: "Login",
    noAccount: "Don't have an account?",
    signUp: "Sign up",
    or: "or",
  },
  errors: {
    invalidEmail: "Please enter a valid email address",
    emailInUse: "This email is already registered",
    invalidCredentials: "Invalid email or password",
    tooManyAttempts: "Too many attempts. Please try again later.",
    default: "An error occurred. Please try again.",
  },
  appleAuth: {
    login: "Login with Apple",
    signup: "Sign up with Apple",
    processing: "Authenticating with Apple...",
    loginCancelled: "Login with Apple was cancelled",
    appleAuthNotAvailable:
      "Login with Apple is not available on this device",
  },
  emailAuth: {
    signup: {
      title: "Register",
      subtitle: "Enter your email",
      emailPlaceholder: "Enter your email",
      submit: "Sign up with Email",
      terms: {
        agree: "I accept and commit to complying with the",
        termsAndConditions: "Terms and Conditions",
        and: "as well as the",
        privacyPolicy: "Privacy Policy",
      },
    },
    login: {
      title: "Login",
      subtitle: "Enter your email",
      emailPlaceholder: "Enter your email",
      submit: "Login with Email",
    },
    confirmation: {
      title: "Check your email",
      message:
        "We've sent a link valid for 1 hour to login to your account.",
      webMessage:
        "We've sent a link to your email. Please check your inbox and click the login link to access your account.",
      spamNote:
        "Remember to check your spam folder if you don't see our email.",
      openEmail: "Open Email App",
      gotIt: "Got it",
      errors: {
        invalid: "The magic link is invalid or has expired",
        expired: "Magic link has expired. Please request a new one.",
        failed: "Failed to sign in with magic link. Please try again.",
        tryAgain: "Try again?",
        sendNew: "Send new link",
      },
      sending: "Sending...",
    },
    invalidLink: {
      title: "Invalid Link",
      heading: "This link has expired",
      message:
        "The login link you clicked is no longer valid. This can happen if the link has expired or has already been used. Please request a new login link to continue.",
      tryAgain: "Request New Link",
    },
  },
  devLogin: {
    orDev: "dev",
    button: "Developer Login",
    signingIn: "Signing in...",
    failed: "Developer login failed. Check your dev credentials.",
    missingCredentials: "Developer login is not configured.",
  },
};
