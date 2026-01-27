export const recipes = {
  common: {
    search: "Search recipes...",
    loading: "Loading recipes...",
    error: "Error loading recipes",
    portions: "Portions",
    prepTime: "Prep",
    totalTime: "Total",
    ingredients: "Ingredients",
    instructions: "Instructions",
    steps: "steps",
    difficulty: {
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
    },
    emptyState: "No recipes found",
    noRecipesFound: "No recipes found",
    usefulItems: "Useful Items",
  },
  detail: {
    ingredients: {
      heading: "Ingredients",
      main: "Main Ingredients",
      optional: "optional",
      quantity: '{{amount}} {{unit}}{{connector ? " " + connector : ""}}',
    },
    steps: {
      heading: "Instructions",
      section: "Section",
      parameters: {
        time: {
          minutes: "{{count}} mins.",
          seconds: "{{count}} sec.",
        },
        speed: "speed {{speed}}",
        reversed: "reverse blades",
      },
    },
    tips: "Tips & Tricks",
    usefulItems: {
      heading: "Useful Items",
    },
  },
  cookingGuide: {
    subtitle: "Mise en place",
    start: "Cook now!",
    intro: {
      greeting: "Let's cook something delicious today!",
      miseEnPlace: {
        one: "First, let's do our ",
        two: "\nmise en place\n",
        three: "by preparing all the ingredients we'll need.",
      },
      checkboxSteps: {
        checkmark: "Check off",
        steps:
          "each ingredient as you get it ready, then click 'next' for the next step.",
      },
    },
    navigation: {
      step: "Step {{step}} of {{total}}",
      finish: "Finish",
      next: "Next",
      back: "Back",
    },
    miseEnPlace: {
      ingredients: {
        heading: "Ingredients",
      },
      usefulItems: {
        heading: "Useful Items",
      },
    },
  },
  rating: {
    howWasIt: "How was it?",
    feedbackLabel: "Share your thoughts (optional)",
    feedbackPlaceholder:
      "Tell us what you liked or how we can improve this recipe...",
    pleaseSelectRating: "Please select a rating",
    submitError: "Failed to submit rating. Please try again.",
    thankYou: "Thank you for your feedback!",
    skip: "Skip",
    submit: "Submit",
    beFirstToRate: "Be the first to rate!",
    yourRating: "Your rating",
    rateThisRecipe: "Rate this recipe",
    tapToUpdateRating: "Tap a star to update your rating",
    rateStar: "Rate {{count}} star",
    rateStars: "Rate {{count}} stars",
    ratingsCount: "{{count}} ratings",
    ratingCount: "{{count}} rating",
  },
  share: {
    message: "Check out this recipe on YummyYummix!",
  },
};
