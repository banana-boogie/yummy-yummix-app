export const auth = {
  processing: "Procesando autenticación...",
  common: {
    haveAccount: "¿Ya tienes una cuenta?",
    login: "Inicia Sesión",
    noAccount: "¿Aún no tienes una cuenta?",
    signUp: "¡Regístrate!",
    or: "o",
  },
  errors: {
    invalidEmail: "Por favor ingresa un correo electrónico válido",
    emailInUse: "Este correo electrónico ya está registrado",
    invalidCredentials: "Correo electrónico o contraseña inválidos",
    tooManyAttempts: "Demasiados intentos. Por favor, inténtalo más tarde.",
    default: "Ha ocurrido un error. Por favor, inténtalo de nuevo.",
  },
  appleAuth: {
    login: "Iniciar sesión con Apple",
    signup: "Registrarse con Apple",
    processing: "Autenticando con Apple...",
    loginCancelled: "Se canceló el inicio de sesión con Apple",
    appleAuthNotAvailable:
      "Iniciar sesión con Apple no está disponible en este dispositivo",
  },
  emailAuth: {
    signup: {
      title: "¡Regístrate!",
      subtitle: "Ingresa tu correo electrónico",
      emailPlaceholder: "Ingresa tu correo electrónico",
      submit: "Registrarte con Email",
      terms: {
        agree: "Acepto y me comprometo a cumplir los",
        termsAndConditions: "Términos y Condiciones",
        and: "así como la",
        privacyPolicy: "Política de Privacidad",
      },
    },
    login: {
      title: "¡Inicia sesión!",
      subtitle: "Ingresa tu correo electrónico",
      emailPlaceholder: "Ingresa tu correo electrónico",
      submit: "Iniciar Sesión con Email",
    },
    confirmation: {
      title: "¡Checa tu correo!",
      message:
        "Te hemos enviado un enlace válido por 1 hora para iniciar sesión en tu cuenta.",
      webMessage:
        "Hemos enviado un enlace a tu correo. Por favor revisa tu bandeja de entrada y haz clic en el enlace de inicio de sesión para acceder a tu cuenta.",
      spamNote:
        "Recuerda revisar tu bandeja de SPAM en caso de que no veas nuestro correo en tu bandeja de entrada.",
      openEmail: "Abrir App de Correo",
      gotIt: "Entendido",
      errors: {
        invalid: "El enlace es inválido o ha expirado",
        expired: "El enlace ha expirado. Por favor, solicita uno nuevo.",
        failed:
          "Falló el inicio de sesión con enlace mágico. Por favor, inténtalo de nuevo.",
        tryAgain: "Inténtalo de nuevo?",
        sendNew: "Enviar nuevo enlace",
      },
      sending: "Enviando...",
    },
    invalidLink: {
      title: "Enlace Inválido",
      heading: "Este enlace ha expirado",
      message:
        "El enlace de inicio de sesión que has hecho clic ya no es válido. Esto puede ocurrir si el enlace ha expirado o ya ha sido utilizado. Por favor, solicita un nuevo enlace de inicio de sesión para continuar.",
      tryAgain: "Solicitar Nuevo Enlace",
    },
  },
  devLogin: {
    orDev: "dev",
    button: "Inicio de sesión de desarrollo",
    signingIn: "Iniciando sesión...",
    failed:
      "Falló el inicio de sesión de desarrollo. Revisa tus credenciales.",
    missingCredentials:
      "El inicio de sesión de desarrollo no está configurado.",
  },
};
