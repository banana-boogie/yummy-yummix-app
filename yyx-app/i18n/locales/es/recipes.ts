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
    noResultsIrmixyPrompt: "¿No encuentras lo que buscas? ¡Te puedo ayudar!",
    askIrmixy: "Pregunta a Irmixy",
    kitchenTools: "Utensilios de Cocina",
    servings: "porciones",
    cookingMode: {
      slow_cook: "Cocción Lenta",
      rice_cooker: "Arrocera",
      sous_vide: "Sous Vide",
      fermentation: "Fermentación",
      open_cooking: "Cocción Abierta",
      high_temperature: "Dorar",
      dough: "Masa",
      turbo: "Turbo",
    },
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
      miseEnPlace: {
        one: "Hagamos nuestro",
        two: "\nmise en place\n",
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
      askIrmixy: "Preguntarle a Irmixy",
      exitCookingGuide: "Salir de la guía de cocina",
      exit: "Salir",
      needHelp: "¿Necesitas ayuda?",
      irmixyLabel: "Irmixy",
    },
    miseEnPlace: {
      ingredients: {
        heading: "Ingredientes",
      },
      kitchenTools: {
        heading: "Utensilios de Cocina",
      },
    },
    timerStart: "Iniciar",
    timerPause: "Pausar",
    timerReset: "Reiniciar",
    timerDone: "¡Tiempo!",
  },
  share: {
    message: "¡Mira esta receta en YummyYummix!",
  },
};
