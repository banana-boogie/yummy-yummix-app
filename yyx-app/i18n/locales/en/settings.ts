export const settings = {
  title: "Settings",
  language: "Language",
  signOut: "Sign out",
  // NOTE: The restartTitle, restartMessage and restartButton are in Spanish because
  // if the user is a Spanish speaker, they will be able to see that they need to restart.
  // If the user is an English speaker, they will see that the cancel button is still in English.
  restartTitle: "Restart",
  restartMessage:
    "Please restart the app for the language change to take effect",
  restartButton: "Restart Now",
  cancelButton: "Cancel",
  measurementSystem: "Measurement System",
  metric: "Metric",
  imperial: "Imperial",
  voiceProvider: "Voice Assistant",
  voiceProviderStandard: "Standard",
  voiceProviderPremium: "Premium",
  voiceProviderStandardDesc: "HearThinkSpeak - Cost effective",
  voiceProviderPremiumDesc: "OpenAI Realtime - Faster response",
};

export const header = {
  greeting: "Hello {{name}}!",
};

export const measurementUnits = {
  metric: {
    weight: {
      kg: {
        name: "kilogram",
        namePlural: "kilograms",
        symbol: "kg",
      },
      g: {
        name: "gram",
        namePlural: "grams",
        symbol: "g",
      },
    },
    volume: {
      l: {
        name: "liter",
        namePlural: "liters",
        symbol: "L",
      },
      ml: {
        name: "milliliter",
        namePlural: "milliliters",
        symbol: "ml",
      },
    },
  },
  imperial: {
    weight: {
      lb: {
        name: "pound",
        namePlural: "pounds",
        symbol: "lb",
      },
      oz: {
        name: "ounce",
        namePlural: "ounces",
        symbol: "oz",
      },
    },
    volume: {
      gallon: {
        name: "gallon",
        namePlural: "gallons",
        symbol: "gal",
      },
      cup: {
        name: "cup",
        namePlural: "cups",
        symbol: "cup",
      },
      tbsp: {
        name: "tablespoon",
        namePlural: "tablespoons",
        symbol: "tbsp",
      },
      tsp: {
        name: "teaspoon",
        namePlural: "teaspoons",
        symbol: "tsp",
      },
    },
  },
  universal: {
    unit: {
      name: "unit",
      namePlural: "units",
      symbol: "",
    },
    whole: {
      name: "whole",
      namePlural: "whole",
      symbol: "",
    },
  },
};
