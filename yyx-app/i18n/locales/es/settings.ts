export const settings = {
  title: "Configuración",
  language: "Idioma",
  signOut: "Cerrar Sesión",
  // NOTE: The restartTitle, restartMessage and restartButton are in English because
  // The app is currently in Spanish, so if they click English, they will be able to read the English to restart
  // and they will be able to see the cancel button in Spanish.
  restartTitle: "Reinicio Necesario",
  restartMessage:
    "Por favor, reinicie la aplicación para que el cambio de idioma surta efecto. Todos los datos serán actualizados.",
  restartButton: "Reiniciar Ahora",
  cancelButton: "Cancelar",
  measurementSystem: "Unidades",
  metric: "Métrico",
  imperial: "Imperial",
  voiceProvider: "Asistente de Voz",
  voiceProviderStandard: "Estándar",
  voiceProviderPremium: "Premium",
  voiceProviderStandardDesc: "HearThinkSpeak - Económico",
  voiceProviderPremiumDesc: "OpenAI Realtime - Respuesta más rápida",
};

export const header = {
  greeting: "¡Hola {{name}}!",
};

export const measurementUnits = {
  metric: {
    weight: {
      kg: {
        name: "kilogramo",
        namePlural: "kilogramos",
        symbol: "kg",
      },
      g: {
        name: "gramo",
        namePlural: "gramos",
        symbol: "g",
      },
    },
    volume: {
      l: {
        name: "litro",
        namePlural: "litros",
        symbol: "L",
      },
      ml: {
        name: "mililitro",
        namePlural: "mililitros",
        symbol: "ml",
      },
    },
  },
  imperial: {
    weight: {
      lb: {
        name: "libra",
        namePlural: "libras",
        symbol: "lb",
      },
      oz: {
        name: "onza",
        namePlural: "onzas",
        symbol: "oz",
      },
    },
    volume: {
      gallon: {
        name: "galón",
        namePlural: "galones",
        symbol: "gal",
      },
      cup: {
        name: "taza",
        namePlural: "tazas",
        symbol: "cup",
      },
      tbsp: {
        name: "cucharada",
        namePlural: "cucharadas",
        symbol: "cda",
      },
      tsp: {
        name: "cucharadita",
        namePlural: "cucharaditas",
        symbol: "cdita",
      },
    },
  },
  universal: {
    unit: {
      name: "unidad",
      namePlural: "unidades",
      symbol: "",
    },
    whole: {
      name: "entero",
      namePlural: "enteros",
      symbol: "",
    },
  },
};
