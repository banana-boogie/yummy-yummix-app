export const recipes = {
  sections: {
    quick: "Cenas Rápidas Entre Semana",
    forYou: "Solo para Ti",
    family: "Favoritos de la Familia",
    new: "Nuevo Esta Semana",
    all: "Todas las Recetas",
  },
  header: {
    greeting: "¡Hola, {{name}}!",
    subtitle: "¿Qué cocinamos hoy?",
  },
  common: {
    search: "¿Qué se te antoja comer?",
    loading: "Cargando recetas...",
    error: "Error al cargar las recetas",
    portions: "Porciones",
    prepTime: "Prep",
    totalTime: "Total",
    difficultyLabel: "Dificultad",
    ingredients: "Ingredientes",
    instructions: "Instrucciones",
    steps: "pasos",
    difficulty: {
      easy: "Fácil",
      medium: "Medio",
      hard: "Difícil",
    },
    emptyState: "No se encontraron recetas",
    noRecipesFound: "No se encontraron recetas",
    kitchenTools: "Utensilios de Cocina",
    servings: "porciones",
  },
  detail: {
    ingredients: {
      heading: "Ingredientes",
      main: "Ingredientes Principales",
      optional: "opcional",
      quantity: '{{amount}} {{unit}}{{connector ? " " + connector : ""}}',
    },
    steps: {
      heading: "Procedimiento",
      section: "Sección",
      parameters: {
        time: {
          minutes: "{{count}} mins.",
          seconds: "{{count}} seg.",
        },
        speed: "vel. {{speed}}",
        reversed: "giro a la izquierda",
      },
    },
    tips: "Consejos",
    kitchenTools: {
      heading: "Utensilios de Cocina",
      notes: "Notas",
    },
  },
  cookingGuide: {
    subtitle: "Mise en place",
    start: "¡Cocinar hoy!",
    intro: {
      greeting: "¡Qué rica receta vamos a cocinar hoy!",
      miseEnPlace: {
        one: "Lo primero es hacer nuestro",
        two: "\nmise en place\n",
        three: "preparando todos los ingredientes que vamos a necesitar.",
      },
      checkboxSteps: {
        checkmark: "Dale palomita ",
        steps:
          "a cada ingrediente que tengas listo, y luego haz click en 'siguiente' para el próximo paso.",
      },
    },
    navigation: {
      step: "Paso {{step}} de {{total}}",
      finish: "¡Terminar!",
      next: "Siguiente",
      back: "Atrás",
    },
    miseEnPlace: {
      ingredients: {
        heading: "Ingredientes",
      },
      kitchenTools: {
        heading: "Utensilios de Cocina",
      },
    },
  },
  rating: {
    howWasIt: "¿Qué te pareció?",
    feedbackLabel: "Comparte tus comentarios (opcional)",
    feedbackPlaceholder:
      "Cuéntanos qué te gustó o cómo podemos mejorar esta receta...",
    pleaseSelectRating: "Por favor selecciona una calificación",
    submitError: "Error al enviar. Por favor intenta de nuevo.",
    thankYou: "¡Gracias por tu opinión!",
    skip: "Omitir",
    submit: "Enviar",
    beFirstToRate: "¡Sé el primero en calificar!",
    yourRating: "Tu calificación",
    rateThisRecipe: "Califica esta receta",
    tapToUpdateRating: "Toca una estrella para actualizar tu calificación",
    rateStar: "Califica con {{count}} estrella",
    rateStars: "Califica con {{count}} estrellas",
    ratingsCount: "{{count}} calificaciones",
    ratingCount: "{{count}} calificación",
  },
  share: {
    message: "¡Mira esta receta en YummyYummix!",
  },
};
