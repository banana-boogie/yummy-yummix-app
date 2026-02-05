export const onboarding = {
  common: {
    next: "Next",
    back: "Back",
    skip: "Skip",
    finish: "Finish",
    addAnother: "Add Another",
    remove: "Remove",
  },
  steps: {
    welcome: {
      title: "Welcome to YummyYummix!",
      subheading:
        "To get started with your account, tell us a bit about yourself.",
      start: "Get Started!",
    },
    name: {
      title: "What's your name?",
      subtitle: "We'd love to know who we're cooking with.",
      placeholder: "Enter your name here",
    },
    allergies: {
      title: "Do you have any food allergies or intolerances?",
      subtitle: "We want to recommend safe recipes for you.",
      options: {
        none: "No allergies",
        nuts: "Nuts",
        dairy: "Dairy",
        eggs: "Eggs",
        seafood: "Seafood",
        gluten: "Gluten",
        other: "Other (specify)",
      },
      otherPlaceholder: "Please specify your allergy",
    },
    diet: {
      title: "Do you follow any particular diet?",
      subtitle: "Tell us your preferences to suggest adapted recipes.",
      options: {
        none: "No restrictions",
        keto: "Keto",
        lactoVegetarian: "Lacto-vegetarian",
        mediterranean: "Mediterranean",
        ovoVegetarian: "Ovo-vegetarian",
        paleo: "Paleo",
        pescatarian: "Pescatarian",
        sugarFree: "Sugar-free",
        vegan: "Vegan",
        vegetarian: "Vegetarian",
        other: "Other (specify)",
      },
      otherPlaceholder: "Please specify your diet",
    },
    cuisines: {
      title: "What cuisines do you enjoy?",
      subtitle: "This helps us inspire your recipe suggestions. Select all that appeal to you!",
      options: {
        mediterranean: "Mediterranean",
        italian: "Italian",
        mexican: "Mexican",
        asian: "Asian",
        japanese: "Japanese",
        chinese: "Chinese",
        thai: "Thai",
        indian: "Indian",
        middle_eastern: "Middle Eastern",
        greek: "Greek",
        spanish: "Spanish",
        french: "French",
        american: "American",
      },
      skip: "Skip - I'm open to anything!",
    },
    appPreferences: {
      title: "Your Preferences",
      subtitle: "Choose your language and measurement system",
      language: "Language",
      measurementSystem: "Units",
      measurements: {
        metric: {
          title: "Metric",
          examples: "(g, ml, cm)",
        },
        imperial: {
          title: "Imperial",
          examples: "(oz, cups, in)",
        },
      },
    },
    equipment: {
      title: "Kitchen Equipment",
      description: "Select any special equipment you have. This helps us customize recipes for your kitchen.",
      thermomix: {
        title: "Thermomix",
        name: "Thermomix",
        description: "Get step-by-step Thermomix cooking parameters",
        modelQuestion: "Which model do you have?",
        modelRequired: "Please select your Thermomix model",
      },
      air_fryer: {
        name: "Air Fryer",
      },
      other: {
        title: "Other Equipment",
      },
    },
  },
};
