export const onboarding = {
  common: {
    next: "Siguiente",
    back: "Atrás",
    skip: "Omitir",
    finish: "Finalizar",
    addAnother: "Agregar Otra",
    remove: "Eliminar",
  },
  steps: {
    welcome: {
      title: "¡Te damos la bienvenida a YummyYummix!",
      subtitle:
        "Para empezar a usar tu cuenta, cuéntanos un poco sobre ti.",
      start: "¡Empezar!",
    },
    name: {
      title: "¿Cómo te llamas?",
      subtitle: "Nos encantaría saber con quién cocinamos.",
      placeholder: "Escribe tu nombre aquí",
    },
    allergies: {
      title: "¿Tienes alguna alergia o intolerancia alimentaria?",
      subtitle: "Queremos recomendarte recetas seguras para ti.",
      options: {
        none: "No tengo alergias",
        nuts: "Nueces",
        dairy: "Lácteos",
        eggs: "Huevos",
        seafood: "Mariscos",
        gluten: "Gluten",
        other: "Otra (especificar)",
      },
      otherPlaceholder: "Por favor, especifica tu alergia",
    },
    diet: {
      title: "¿Sigues algún tipo de alimentación particular?",
      subtitle:
        "Cuéntanos tus preferencias para sugerirte recetas adaptadas a ti.",
      options: {
        none: "Sin restricciones",
        keto: "Keto",
        lactoVegetarian: "Lacto vegetariana",
        mediterranean: "Mediterránea",
        ovoVegetarian: "Ovo vegetariana",
        paleo: "Paleo",
        pescatarian: "Pescatariana",
        sugarFree: "Sin azúcar",
        vegan: "Vegana",
        vegetarian: "Vegetariana",
        other: "Otra (especificar)",
      },
      otherPlaceholder: "Por favor, especifica tu dieta",
    },
    appPreferences: {
      title: "Tus Preferencias",
      subtitle: "Elige tu idioma y sistema de medidas",
      language: "Idioma",
      measurementSystem: "Unidades",
      measurements: {
        metric: {
          title: "Métrico",
          examples: "(g, ml, cm)",
        },
        imperial: {
          title: "Imperial",
          examples: "(oz, tazas, in)",
        },
      },
    },
    equipment: {
      title: "Equipo de Cocina",
      description: "Selecciona cualquier equipo especial que tengas. Esto nos ayuda a personalizar las recetas para tu cocina.",
      thermomix: {
        title: "Thermomix",
        name: "Thermomix",
        description: "Obtén parámetros de cocción paso a paso para Thermomix",
        modelQuestion: "¿Qué modelo tienes?",
      },
      air_fryer: {
        name: "Freidora de Aire",
      },
      other: {
        title: "Otro Equipo",
      },
    },
  },
};
