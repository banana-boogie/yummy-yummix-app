import { I18n } from 'i18n-js';

// Set the key-value pairs for the different languages you want to support.
const translations = {
  en: {
    common: {
      english: 'English',
      spanish: 'Spanish',
      ingredients: 'Ingredients',
      ok: 'OK',
      save: 'Save',
      saved: 'Saved',
      back: 'Back',
      remove: 'Remove',
      cancel: 'Cancel',
      import: 'Import',
      done: 'Done',
      next: 'Next',
      delete: 'Delete',
      selectDate: 'Select Date',
      errors: {
        title: 'Error',
        imageTooLarge: 'Image must be less than 2MB',
        invalidImageType: 'Only JPEG and PNG images are allowed',
        default: 'Sorry, something went wrong.',
        permissionDenied: 'Permission denied',
        emailUs: 'Please email us at ',
      },
      image: 'Image',
      uploadImage: 'Upload Image',
      changeImage: 'Change Image',
      you: 'You',
    },
    auth: {
      processing: 'Processing authentication...',
      common: {
        haveAccount: 'Already have an account?',
        login: 'Login',
        noAccount: "Don't have an account?",
        signUp: 'Sign up',
        or: 'or',
      },
      errors: {
        invalidEmail: 'Please enter a valid email address',
        emailInUse: 'This email is already registered',
        invalidCredentials: 'Invalid email or password',
        tooManyAttempts: 'Too many attempts. Please try again later.',
        default: 'An error occurred. Please try again.',
      },
      appleAuth: {
        login: 'Login with Apple',
        signup: 'Sign up with Apple',
        processing: 'Authenticating with Apple...',
        loginCancelled: 'Login with Apple was cancelled',
        appleAuthNotAvailable: 'Login with Apple is not available on this device',
      },
      emailAuth: {
        signup: {
          title: 'Register',
          subtitle: 'Enter your email',
          emailPlaceholder: 'Enter your email',
          submit: 'Sign up with Email',
          terms: {
            agree: 'I accept and commit to complying with the',
            termsAndConditions: 'Terms and Conditions',
            and: 'as well as the',
            privacyPolicy: 'Privacy Policy'
          }
        },
        login: {
          title: 'Login',
          subtitle: 'Enter your email',
          emailPlaceholder: 'Enter your email',
          submit: 'Login with Email'
        },
        confirmation: {
          title: 'Check your email',
          message: "We've sent a link valid for 1 hour to login to your account.",
          webMessage: "We've sent a link to your email. Please check your inbox and click the login link to access your account.",
          spamNote: 'Remember to check your spam folder if you don\'t see our email.',
          openEmail: 'Open Email App',
          gotIt: 'Got it',
          errors: {
            invalid: 'The magic link is invalid or has expired',
            expired: 'Magic link has expired. Please request a new one.',
            failed: 'Failed to sign in with magic link. Please try again.',
            tryAgain: 'Try again?',
            sendNew: 'Send new link'
          },
          sending: 'Sending...'
        },
        invalidLink: {
          title: 'Invalid Link',
          heading: 'This link has expired',
          message: 'The login link you clicked is no longer valid. This can happen if the link has expired or has already been used. Please request a new login link to continue.',
          tryAgain: 'Request New Link'
        }
      }
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      signOut: 'Sign out',
      // NOTE: The restartTitle, restartMessage and restartButton are in Spanish because
      // if the user is a Spanish speaker, they will be able to see that they need to restart.
      // If the user is an English speaker, they will see that the cancel button is still in English.
      restartTitle: 'Restart',
      restartMessage: 'Please restart the app for the language change to take effect',
      restartButton: 'Restart Now',
      cancelButton: 'Cancel',
      measurementSystem: 'Measurement System',
      metric: 'Metric',
      imperial: 'Imperial',
    },
    header: {
      greeting: 'Hello {{name}}!',
    },
    measurementUnits: {
      metric: {
        weight: {
          kg: {
            name: 'kilogram',
            namePlural: 'kilograms',
            symbol: 'kg'
          },
          g: {
            name: 'gram',
            namePlural: 'grams',
            symbol: 'g'
          }
        },
        volume: {
          l: {
            name: 'liter',
            namePlural: 'liters',
            symbol: 'L'
          },
          ml: {
            name: 'milliliter',
            namePlural: 'milliliters',
            symbol: 'ml'
          }
        }
      },
      imperial: {
        weight: {
          lb: {
            name: 'pound',
            namePlural: 'pounds',
            symbol: 'lb'
          },
          oz: {
            name: 'ounce',
            namePlural: 'ounces',
            symbol: 'oz'
          }
        },
        volume: {
          gallon: {
            name: 'gallon',
            namePlural: 'gallons',
            symbol: 'gal'
          },
          cup: {
            name: 'cup',
            namePlural: 'cups',
            symbol: 'cup'
          },
          tbsp: {
            name: 'tablespoon',
            namePlural: 'tablespoons',
            symbol: 'tbsp'
          },
          tsp: {
            name: 'teaspoon',
            namePlural: 'teaspoons',
            symbol: 'tsp'
          }
        }
      },
      universal: {
        unit: {
          name: 'unit',
          namePlural: 'units',
          symbol: ''
        },
        whole: {
          name: 'whole',
          namePlural: 'whole',
          symbol: ''
        },
      },
    },
    recipes: {
      common: {
        search: 'Search recipes...',
        loading: 'Loading recipes...',
        error: 'Error loading recipes',
        portions: 'Portions',
        prepTime: 'Prep',
        totalTime: 'Total',
        difficulty: {
          easy: 'Easy',
          medium: 'Medium',
          hard: 'Hard'
        },
        emptyState: 'No recipes found',
        noRecipesFound: 'No recipes found',
      },
      detail: {
        ingredients: {
          heading: 'Ingredients',
          main: 'Main Ingredients',
          optional: 'optional',
          quantity: '{{amount}} {{unit}}{{connector ? " " + connector : ""}}'
        },
        steps: {
          heading: 'Instructions',
          section: 'Section',
          parameters: {
            time: {
              minutes: '{{count}} mins.',
              seconds: '{{count}} sec.',
            },
            speed: 'speed {{speed}}',
            reversed: 'reverse blades'
          }
        },
        tips: 'Tips & Tricks',
        usefulItems: {
          heading: 'Useful Items',
        }
      },
      cookingGuide: {
        start: 'Cook now!',
        intro: {
          greeting: "Let's cook something delicious today!",
          miseEnPlace: {
            one: "First, let's do our ",
            two: "\nmise en place\n",
            three: "by preparing all the ingredients we'll need.",
          },
          checkboxSteps: {
            checkmark: "Check off",
            steps: "each ingredient as you get it ready, then click 'next' for the next step.",
          }
        },
        navigation: {
          step: 'Step {{step}} of {{total}}',
          finish: 'Finish',
          next: 'Next',
          back: 'Back'
        },
        miseEnPlace: {
          ingredients: {
            heading: 'Ingredients',
          },
          usefulItems: {
            heading: 'Useful Items',
          }
        }
      },
      share: {
        message: 'Check out this recipe on YummyYummix!',
      }
    },
    onboarding: {
      common: {
        next: 'Next',
        back: 'Back',
        skip: 'Skip',
        finish: 'Finish',
        addAnother: 'Add Another',
        remove: 'Remove',
      },
      steps: {
        welcome: {
          title: "Welcome to YummyYummix!",
          subheading: "To get started with your account, tell us a bit about yourself.",
          start: "Get Started!",
        },
        name: {
          title: "What's your name?",
          subtitle: "We'd love to know who we're cooking with.",
          placeholder: "Enter your name here"
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
            other: "Other (specify)"
          },
          otherPlaceholder: 'Please specify your allergy',
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
            other: "Other (specify)"
          },
          otherPlaceholder: 'Please specify your diet',
        },
        appPreferences: {
          title: "Your Preferences",
          subtitle: "Choose your language and measurement system",
          language: "Language",
          measurementSystem: "Units",
          measurements: {
            metric: {
              title: "Metric",
              examples: "(g, ml, cm)"
            },
            imperial: {
              title: "Imperial",
              examples: "(oz, cups, in)"
            }
          }
        },
      }
    },
    validation: {
      required: 'This field is required',
      nameMinLength: 'Name must be at least 2 characters',
      nameMaxLength: 'Name must be less than 50 characters',
      otherAllergyRequired: 'Please specify your allergy',
      otherDietRequired: 'Please specify your diet',
      missingValue: 'Please enter a value before adding another',
      number: 'Must be a number',
      minValue: 'Minimum value is {{min}}',
      maxValue: 'Maximum value is {{max}}',
      minMaxValue: 'Value must be between {{min}} and {{max}}',
      decimalValue: 'Only .5 decimal is allowed',
      endSpeedGreaterThanStart: 'End speed must be greater than or equal to start speed',
    },
    profile: {
      title: 'Profile',
      greeting: 'Hello!',
      editProfile: 'Edit Profile',
      personalInfo: 'Personal Information',
      settings: 'Settings',
      uploadImage: 'Upload Image',
      name: 'Name',
      namePlaceholder: 'Enter your name',
      bio: 'Bio',
      bioPlaceholder: 'Tell us about yourself',
      save: 'Save Changes',
      features: {
        planner: 'My Planner',
        recipes: 'My Recipes',
        shoppingList: 'My Shopping List',
        achievements: 'My Courses & Achievements'
      },
      logout: 'Sign Out',
      changePhoto: 'Change photo',
      configurePersonalData: 'Configure personal data',
      username: 'Username',
      language: 'Language',
      measurementSystem: 'Measurement System',
      deleteAccount: 'Delete Account',
      deleteAccountFlow: {
        title: 'Delete Account',
        warning: 'This step is irreversible. Once your account is deleted all your data will be lost without possibility of recovery.',
        confirmQuestion: 'Do you still want to delete your account?',
        cancel: 'Cancel',
        delete: 'Delete account',
        feedback: {
          title: 'Before you go',
          subtitle: "We'd like to know why. Your feedback helps us improve and provide a better experience.",
          selectReason: 'Please select all reasons that apply:',
          reasons: {
            noUse: "I don't use the app",
            technical: 'Technical problems',
            foundBetter: 'Found another app I prefer',
            other: 'Other reason'
          },
          tellUsMore: 'Please tell us more about your experience.',
          finalConfirmation: {
            title: 'Final Confirmation',
            message: 'Are you absolutely sure you want to delete your account? This action cannot be undone.',
            cancel: 'Keep My Account',
            confirm: 'Yes, Delete My Account'
          },
          requestReceived: {
            title: 'Request Received',
            message: 'We have received your account deletion request. For security purposes, this process will be completed within 14 days. During this time, you can still cancel the deletion by contacting our support team.',
            ok: 'OK'
          }
        }
      },
      personalData: {
        title: 'Personal Data',
        gender: 'Gender',
        genderOptions: {
          male: 'Male',
          female: 'Female',
          other: 'Other',
          preferNotToSay: 'Prefer not to say'
        },
        birthDate: 'Birth Date',
        height: 'Height',
        weight: 'Weight',
        activityLevel: 'Activity Level',
        activityLevelOptions: {
          sedentary: 'Sedentary',
          lightlyActive: 'Lightly Active',
          moderatelyActive: 'Moderately Active',
          veryActive: 'Very Active',
          extraActive: 'Extra Active'
        },
        dietaryRestrictions: 'Dietary Restrictions',
        updateDietaryRestrictions: 'Update Dietary Restrictions',
        heightPlaceholder: 'Enter your height',
        weightPlaceholder: 'Enter your weight',
        cm: 'cm',
        kg: 'kg',
        lb: 'lb',
        ft: 'ft',
        in: 'in',
        diet: 'Diet',
        dietTypes: {
          none: 'No specific diet',
          vegetarian: 'Vegetarian',
          vegan: 'Vegan',
          pescatarian: 'Pescatarian',
          paleo: 'Paleo',
          keto: 'Keto',
          glutenFree: 'Gluten-free',
          dairyFree: 'Dairy-free',
          other: 'Other'
        },
        allergies: 'Allergies',
        allergyTypes: {
          none: 'No allergies',
          peanuts: 'Peanuts',
          treeNuts: 'Tree nuts',
          dairy: 'Dairy',
          eggs: 'Eggs',
          soy: 'Soy',
          wheat: 'Wheat',
          fish: 'Fish',
          shellfish: 'Shellfish',
          other: 'Other'
        },
        otherDietPlaceholder: 'Enter your diet',
        otherAllergyPlaceholder: 'Enter your allergy',
        addAnother: 'Add another'
      }
    },
    admin: {
      common: {
        dashboard: 'Dashboard',
        recipes: 'Recipes',
        ingredients: 'Ingredients',
        tags: 'Tags',
        users: 'Users',
        settings: 'Settings',
        actions: 'Actions',
        loading: 'Loading...',
        image: 'Image',
        changeImage: 'Change Image',
        uploadImage: 'Upload Image',
      },
      recipes: {
        list: {
          title: 'Recipes',
          createButton: 'Create Recipe',
          search: 'Search recipes...',
          noRecipes: 'No recipes found',
          published: 'Published',
          draft: 'Draft',
          view: 'View',
          edit: 'Edit',
          delete: 'Delete',
          filters: {
            all: 'All Recipes',
            published: 'Published',
            drafts: 'Drafts',
          },
          deleteConfirm: {
            title: 'Delete Recipe',
            message: 'Are you sure you want to delete this recipe? This action cannot be undone.',
            cancel: 'Cancel',
            confirm: 'Delete',
          },
        },
        create: {
          title: 'Create Recipe',
          success: 'Recipe created successfully',
          getStarted: 'Let\'s Create a Recipe',
          chooseOption: 'Choose how you want to start creating your new recipe',
          populateWithAI: 'Populate with AI',
          startFromScratch: 'Start from Scratch',
        },
        edit: {
          title: 'Edit Recipe',
          success: 'Recipe updated successfully',
        },
        resume: {
          title: 'Resume Draft Recipe',
          message: 'You have a saved draft recipe. Would you like to continue where you left off?',
          continue: 'Continue Draft',
          startNew: 'Start New Recipe',
          untitledRecipe: 'Untitled Recipe'
        },
        form: {
          initialSetup: {
            populateRecipe: 'Populate Recipe',
            pasteHere: 'Paste your recipe here...',
            missingIngredients: 'Missing Ingredients',
            missingTags: 'Missing Tags',
            createIngredient: 'Create Ingredient',
            createTag: 'Create Tag',
            missingUsefulItems: 'Missing Useful Items',
            createUsefulItem: 'Create Useful Item',
            continueRecipe: 'Continue Recipe',
          },
          basicInfo: {
            title: 'Basic Information',
            nameEnglish: 'Name',
            nameSpanish: 'Spanish Name',
            description: 'Description',
            descriptionEs: 'Spanish Description',
            preparationTime: 'Preparation Time',
            cookingTime: 'Cooking Time',
            servings: 'Servings',
            difficulty: 'Difficulty',
            category: 'Category',
            difficultyPlaceholder: 'Select Difficulty',
            portions: 'Portions',
            prepTime: 'Prep Time (minutes)',
            totalTime: 'Total Time (minutes)',
            usefulItemsEnglish: 'Useful Items (English)',
            usefulItemsSpanish: 'Useful Items (Spanish)',
            tipsAndTricksEnglish: 'Tips & Tricks (English)',
            tipsAndTricksSpanish: 'Tips & Tricks (Spanish)',
            recipeImage: 'Recipe Image',
            changeImage: 'Change Image',
            uploadImage: 'Upload Image',
          },
          ingredientsInfo: {
            title: 'Ingredients',
            description: 'Search for ingredients and add them to your recipe. You can specify quantities, units, and notes for each ingredient.',
            searchPlaceholder: 'Search for ingredients...',
            selectedIngredients: 'Selected Ingredients',
            itemsSelected: 'items',
            noIngredientsFound: 'No ingredients found',
            createNewIngredient: 'Create New Ingredient',
            addIngredient: 'Add Ingredient',
            editIngredient: 'Edit Ingredient',
            removeIngredient: 'Remove Ingredient',
            noIngredientsSelected: 'No ingredients selected',
            selectFromLeft: 'Use the search on the left to find and add ingredients',
            selectIngredient: 'Select ingredient',
            noSearchResults: 'No ingredients match your search',
            noIngredients: 'No ingredients available',
            editTitle: 'Edit Ingredient',
            addTitle: 'Add Ingredient',
            details: 'Ingredient Details',
            quantity: 'Quantity',
            quantityPlaceholder: 'e.g. 1, 2, 0.5',
            measurementUnit: 'Measurement Unit',
            measurementUnitPlaceholder: 'Select a measurement unit',
            optional: 'Optional',
            quantityTitle: 'Quantity',
            notesTitle: 'Notes',
            notesEn: 'Notes (English)',
            notesEs: 'Notes (Spanish)',
            notesEnPlaceholder: 'Additional information about this ingredient (English)',
            notesEsPlaceholder: 'Additional information about this ingredient (Spanish)',
            notesHelperText: 'Appears in brackets beside the ingredient name',
            tipTitle: 'Tips',
            tipEn: 'Tip (English)',
            tipEs: 'Tip (Spanish)',
            recipeSectionEn: 'Recipe Section (English)',
            recipeSectionEs: 'Recipe Section (Spanish)',
            addToRecipe: 'Add to recipe',
          },
          usefulItemsInfo: {
            title: 'Useful Items',
            description: 'Search for useful items and add them to your recipe. You can reorder them to show the most important ones first.',
            searchPlaceholder: 'Search useful items...',
            createNew: 'Create New',
            selectedHeader: 'Selected Useful Items',
            selectedCount: '{{count}} items',
            noSelectedItems: 'No useful items selected',
            noUsefulItems: 'No useful items available',
            noSearchResults: 'No useful items match your search',
            editItem: 'Edit Useful Item',
            addItem: 'Add Useful Item',
            duplicateError: 'This useful item is already added to the recipe',
            fetchError: 'Failed to load useful items',
            errorTitle: 'Error',
            notesEnLabel: 'Notes (English)',
            notesEsLabel: 'Notes (Spanish)',
          },
          stepsInfo: {
            title: 'Steps',
            addStep: 'Add Step',
            editStep: 'Edit Step',
            updateStep: 'Update Step',
            removeStep: 'Remove Step',
            tipEn: 'Tips for this ingredient (English)',
            tipEs: 'Tip for this ingredient (Spanish)',
            tipTitle: 'Tips',
            recipeSectionEn: 'Recipe Section (English)',
            recipeSectionEs: 'Recipe Section (Spanish)',
            instructionHeadingEn: 'English Instructions',
            instructionHeadingEs: 'Spanish Instructions',
            thermomixParameters: 'Thermomix Settings',
            thermomixTime: 'Time',
            minutes: 'min',
            seconds: 'sec',
            thermomixSpeed: 'Speed',
            thermomixIsBladeReversed: 'reverse blades',
            thermomixTemperature: 'Temperature',
            thermomixHelperText: 'Add Thermomix settings if this step requires using a Thermomix',
            thermomixParamsFormat: 'Add %thermomix% to the step to include the Thermomix settings',
            stepIngredients: 'Ingredients',
            stepIngredientsHelperText: 'Select which ingredients are used in this step',
            images: 'Step Images',
            uploadImage: 'Upload Step Image',
            textFormattingHelp: 'Text Formatting Help',
            boldText: 'Bold Text',
            boldTextDescription: 'Add **text** to make it bold',
            newLine: 'New Line',
            newLineDescription: 'Add | to start a new line',
            thermomixParams: 'Thermomix Settings',
            thermomixParamsDescription: 'Include %thermomix% where settings should appear',
            bulletPoint: 'Bullet Point',
            bulletPointDescription: 'Use {•}text{/•} to create bulleted items',
            noSteps: 'No steps added yet',
            addStepPrompt: 'Click "Add Step" to start creating recipe steps',
            noStepText: 'No instruction text provided',
            stepTitle: 'Step Title',
            stepTitlePlaceholder: 'Optional step title',
            instruction: 'Step',
            recipeSection: 'Recipe Section',
            singleSpeed: 'Single Speed',
            speedRange: 'Speed Range',
            speedStart: 'Start Speed',
            speedEnd: 'End Speed',
            available: 'Available'
          },
          tagsInfo: {
            title: 'Tags',
            searchTags: 'Search tags...',
            selectedTags: 'Selected Tags',
            noTagsSelected: 'No tags selected',
            availableTags: 'Available Tags',
            noTagsFound: 'No tags found',
            selectCategories: 'Filter by categories',
            spanishName: 'Spanish Name',
            englishName: 'English Name',
            categories: 'Categories',
            allCategories: 'All Categories',
            clearFilters: 'Clear filters'
          },
          reviewInfo: {
            title: 'Review',
            reviewHelperText: 'Review your recipe before publishing',
            ingredients: 'Ingredients',
            steps: 'Steps',
            tags: 'Tags',
            usefulItems: 'Useful Items',
            publish: 'Publish Recipe',
            noTagsFound: 'No tags found',
          },
          tabs: {
            details: 'Details',
            ingredients: 'Ingredients',
            steps: 'Steps',
            tags: 'Tags',
            review: 'Review',
          },
          saveRecipe: 'Save Recipe',
          save: 'Save',
          cancel: 'Cancel',
          draft: 'Draft',
          published: 'Published',
          status: 'Status',
          publishRecipe: 'Publish Recipe',
          unpublishRecipe: 'Unpublish Recipe',
          deleteRecipe: 'Delete Recipe',
          backToList: 'Back to List',
          createRecipe: 'Create Recipe',
          updateRecipe: 'Update Recipe',
          manage: 'Manage',
          publish: 'Publish',
          saveAsDraft: 'Save as Draft',
          minutes: 'minutes',
          hour: 'hour',
          hours: 'hours',
          easy: 'Easy',
          medium: 'Medium',
          hard: 'Hard',
          ingredient: 'Ingredient',
          errors: {
            nameRequired: 'Recipe name is required in at least one language',
            difficultyRequired: 'Difficulty is required',
            prepTimeRequired: 'Preparation time is required',
            totalTimeRequired: 'Total time is required',
            portionsRequired: 'Number of portions is required',
            ingredientsRequired: 'At least one ingredient is required',
            stepsRequired: 'At least one step is required',
            imageRequired: 'Recipe image is required',
            saveFailed: 'Failed to save recipe',
            loadFailed: 'Failed to load recipe'
          },
          saveSuccess: {
            title: 'Recipe Saved',
            message: 'Your recipe has been saved successfully'
          },
          saveError: {
            title: 'Error Saving Recipe',
            message: 'There were some errors in your recipe. Please check the highlighted fields and try again.'
          }
        },
        errors: {
          nameRequired: 'Recipe name is required in at least one language',
          difficultyRequired: 'Difficulty is required',
          prepTimeRequired: 'Preparation time is required',
          totalTimeRequired: 'Total time is required',
          portionsRequired: 'Number of portions is required',
          ingredientsRequired: 'At least one ingredient is required',
          stepsRequired: 'At least one step is required',
          imageRequired: 'Recipe image is required',
          publishFailed: 'Failed to publish recipe.'
        },
      },
      ingredients: {
        editTitle: 'Edit Ingredient',
        createTitle: 'Create Ingredient',
        nameEn: 'Name (English)',
        nameEs: 'Name (Spanish)',
        pluralNameEn: 'Plural Name (English)',
        pluralNameEs: 'Plural Name (Spanish)',
        image: 'Ingredient Image',
        uploadImage: 'Upload Image',
        changeImage: 'Change Image',
        translations: 'Translations',
        nutritionalFacts: {
          title: 'Nutritional Facts',
          subtitle: 'Values per 100g of ingredient',
          roundingRules: 'Round calories to whole numbers. Round protein, fat, and carbs to one decimal place.',
          calories: 'Calories',
          protein: 'Protein',
          fat: 'Fat',
          carbs: 'Carbs',
          autoFillButton: 'Auto-detect Nutritional Facts',
          errors: {
            noIngredient: 'Please enter an ingredient name before auto-detecting nutritional facts',
            fetchFailed: 'Unable to retrieve nutritional facts. Please try again or enter values manually.'
          },
          unit: {
            calories: 'kcal',
            grams: 'g'
          },
          validation: {
            required: 'This field is required',
            invalidNumber: 'Please enter a valid number',
            minValue: 'Value must be greater than or equal to 0'
          }
        },
        success: {
          title: 'Success',
          createSuccessMessage: 'Ingredient created successfully',
          updateSuccessMessage: 'Ingredient updated successfully'
        },
        confirmDeletion: {
          title: 'Confirm Deletion',
          message: 'Are you sure you want to delete this ingredient? This action cannot be undone.'
        },
        errors: {
          title: 'Error',
          validationFailed: 'Please check the form for errors',
          createFailed: 'Failed to create ingredient',
          saveFailed: 'Failed to save ingredient. Please try again.'
        }
      },
      tags: {
        searchPlaceholder: 'Search Tags, Categories...',
        addNew: 'Add New Tag',
        createTitle: 'Create New Tag',
        editTitle: 'Edit Tag',
        englishName: 'English Name',
        spanishName: 'Spanish Name',
        englishNamePlaceholder: 'Enter tag name in English',
        spanishNamePlaceholder: 'Enter tag name in Spanish',
        categories: 'Categories',
        basicInfo: 'Basic Information',
        selectedCategories: 'Selected Categories',
        noSelectedCategories: 'No categories selected yet',
        searchCategories: 'Search categories...',
        availableCategories: 'Available Categories',
        noCategoriesFound: 'No categories found',
        deleteTitle: 'Delete Tag',
        deleteMessage: 'Are you sure you want to delete this tag? This action cannot be undone.',
        noTagsFound: 'No tags found',
        addNewCategory: 'Add New Category',
        newCategoryTitle: 'Add New Category',
        categoryNamePlaceholder: 'Enter category name',
        categoryCreated: 'Category created successfully',
      },
      usefulItems: {
        title: 'Manage Useful Items',
        searchPlaceholder: 'Search useful items...',
        createNew: 'New Useful Item',
        noItemsFound: 'No useful items found',
        confirmDeletion: {
          title: 'Confirm Deletion',
          message: 'Are you sure you want to delete {{nameEn}} | {{nameEs}}?'
        },
        errors: {
          title: 'Error',
          deleteFailed: 'Failed to delete useful item',
          saveFailed: 'Failed to save useful item'
        },
        form: {
          createTitle: 'Create Useful Item',
          editTitle: 'Edit Useful Item',
          imageTitle: 'Item Image',
          detailsTitle: 'Item Details',
          nameEn: 'Name (English)',
          nameEs: 'Name (Spanish)',
          nameEnPlaceholder: 'Enter item name in English',
          nameEsPlaceholder: 'Enter item name in Spanish',
          errors: {
            nameEnRequired: 'English name is required',
            nameEsRequired: 'Spanish name is required',
            imageRequired: 'Image is required'
          }
        }
      },
    },
    chat: {
      title: 'Irmixy',
      greeting: "Hi! I'm Irmixy, your AI chef assistant. Ask me anything about cooking!",
      inputPlaceholder: 'Ask me anything about cooking...',
      sendButton: 'Send',
      error: 'Sorry, something went wrong. Please try again.',
      loginRequired: 'Please log in to chat with Irmixy.',
      voice: {
        listening: "I'm listening!",
        thinking: 'Thinking...',
        speaking: 'Speaking!',
        tapToSpeak: 'Tap to speak',
        tapToStop: 'Tap to stop',
        handsFreeModeActive: "Hands-free mode - I'll stop when you're done speaking",
        permissionRequired: 'Microphone permission required',
        couldNotUnderstand: 'Could not understand audio',
        hearing: 'Hearing you...',
        silenceDetected: 'Silence detected',
        waitingForSpeech: 'Waiting for speech...',
      },
    },
  },
  es: {
    common: {
      english: 'Inglés',
      spanish: 'Español',
      ingredients: 'Ingredientes',
      ok: 'OK',
      save: 'Guardar Cambios',
      saved: 'Guardado',
      back: 'Atrás',
      remove: 'Eliminar',
      cancel: 'Cancelar',
      import: 'Import',
      done: 'Listo',
      selectDate: 'Seleccionar Fecha',
      errors: {
        title: 'Error',
        imageTooLarge: 'La imagen debe ser menor de 2MB',
        invalidImageType: 'Solo se permiten imágenes JPEG y PNG',
        default: 'Lo sentimos, algo salió mal.',
        permissionDenied: 'Permiso denegado',
        emailUs: 'Por favor, contacta a',
      },
      image: 'Imagen',
      uploadImage: 'Subir Imagen',
      changeImage: 'Cambiar Imagen',
      you: 'Tú',
    },
    auth: {
      processing: 'Procesando autenticación...',
      common: {
        haveAccount: '¿Ya tienes una cuenta?',
        login: 'Inicia Sesión',
        noAccount: '¿Aún no tienes una cuenta?',
        signUp: '¡Regístrate!',
        or: 'o',
      },
      errors: {
        invalidEmail: 'Por favor ingresa un correo electrónico válido',
        emailInUse: 'Este correo electrónico ya está registrado',
        invalidCredentials: 'Correo electrónico o contraseña inválidos',
        tooManyAttempts: 'Demasiados intentos. Por favor, inténtalo más tarde.',
        default: 'Ha ocurrido un error. Por favor, inténtalo de nuevo.',
      },
      appleAuth: {
        login: 'Iniciar sesión con Apple',
        signup: 'Registrarse con Apple',
        processing: 'Autenticando con Apple...',
        loginCancelled: 'Se canceló el inicio de sesión con Apple',
        appleAuthNotAvailable: 'Iniciar sesión con Apple no está disponible en este dispositivo',
      },
      emailAuth: {
        signup: {
          title: '¡Regístrate!',
          subtitle: 'Ingresa tu correo electrónico',
          emailPlaceholder: 'Ingresa tu correo electrónico',
          submit: 'Registrarte con Email',
          terms: {
            agree: 'Acepto y me comprometo a cumplir los',
            termsAndConditions: 'Términos y Condiciones',
            and: 'así como la',
            privacyPolicy: 'Política de Privacidad'
          }
        },
        login: {
          title: '¡Inicia sesión!',
          subtitle: 'Ingresa tu correo electrónico',
          emailPlaceholder: 'Ingresa tu correo electrónico',
          submit: 'Iniciar Sesión con Email'
        },
        confirmation: {
          title: '¡Checa tu correo!',
          message: 'Te hemos enviado un enlace válido por 1 hora para iniciar sesión en tu cuenta.',
          webMessage: 'Hemos enviado un enlace a tu correo. Por favor revisa tu bandeja de entrada y haz clic en el enlace de inicio de sesión para acceder a tu cuenta.',
          spamNote: 'Recuerda revisar tu bandeja de SPAM en caso de que no veas nuestro correo en tu bandeja de entrada.',
          openEmail: 'Abrir App de Correo',
          gotIt: 'Entendido',
          errors: {
            invalid: 'El enlace es inválido o ha expirado',
            expired: 'El enlace ha expirado. Por favor, solicita uno nuevo.',
            failed: 'Falló el inicio de sesión con enlace mágico. Por favor, inténtalo de nuevo.',
            tryAgain: 'Inténtalo de nuevo?',
            sendNew: 'Enviar nuevo enlace'
          },
          sending: 'Enviando...'
        },
        invalidLink: {
          title: 'Enlace Inválido',
          heading: 'Este enlace ha expirado',
          message: 'El enlace de inicio de sesión que has hecho clic ya no es válido. Esto puede ocurrir si el enlace ha expirado o ya ha sido utilizado. Por favor, solicita un nuevo enlace de inicio de sesión para continuar.',
          tryAgain: 'Solicitar Nuevo Enlace'
        }
      }
    },
    settings: {
      title: 'Configuración',
      language: 'Idioma',
      signOut: 'Cerrar Sesión',
      // NOTE: The restartTitle, restartMessage and restartButton are in English because 
      // The app is currently in Spanish, so if they click English, they will be able to read the English to restart
      // and they will be able to see the cancel button in Spanish.
      restartTitle: 'Reinicio Necesario',
      restartMessage: 'Por favor, reinicie la aplicación para que el cambio de idioma surta efecto. Todos los datos serán actualizados.',
      restartButton: 'Reiniciar Ahora',
      cancelButton: 'Cancelar',
      measurementSystem: 'Unidades',
      metric: 'Métrico',
      imperial: 'Imperial',
    },
    header: {
      greeting: '¡Hola {{name}}!',
    },
    measurementUnits: {
      metric: {
        weight: {
          kg: {
            name: 'kilogramo',
            namePlural: 'kilogramos',
            symbol: 'kg'
          },
          g: {
            name: 'gramo',
            namePlural: 'gramos',
            symbol: 'g'
          }
        },
        volume: {
          l: {
            name: 'litro',
            namePlural: 'litros',
            symbol: 'L'
          },
          ml: {
            name: 'mililitro',
            namePlural: 'mililitros',
            symbol: 'ml'
          }
        }
      },
      imperial: {
        weight: {
          lb: {
            name: 'libra',
            namePlural: 'libras',
            symbol: 'lb'
          },
          oz: {
            name: 'onza',
            namePlural: 'onzas',
            symbol: 'oz'
          }
        },
        volume: {
          gallon: {
            name: 'galón',
            namePlural: 'galones',
            symbol: 'gal'
          },
          cup: {
            name: 'taza',
            namePlural: 'tazas',
            symbol: 'cup'
          },
          tbsp: {
            name: 'cucharada',
            namePlural: 'cucharadas',
            symbol: 'cda'
          },
          tsp: {
            name: 'cucharadita',
            namePlural: 'cucharaditas',
            symbol: 'cdita'
          }
        }
      },
      universal: {
        unit: {
          name: 'unidad',
          namePlural: 'unidades',
          symbol: ''
        },
        whole: {
          name: 'entero',
          namePlural: 'enteros',
          symbol: ''
        }
      }
    },
    recipes: {
      common: {
        search: '¿Qué se te antoja comer?',
        loading: 'Cargando recetas...',
        error: 'Error al cargar las recetas',
        portions: 'Porciones',
        prepTime: 'Prep',
        totalTime: 'Total',
        difficulty: {
          easy: 'Fácil',
          medium: 'Medio',
          hard: 'Difícil'
        },
        emptyState: 'No se encontraron recetas'
      },
      detail: {
        ingredients: {
          heading: 'Ingredientes',
          main: 'Ingredientes Principales',
          optional: 'opcional',
          quantity: '{{amount}} {{unit}}{{connector ? " " + connector : ""}}'
        },
        steps: {
          heading: 'Procedimiento',
          section: 'Sección',
          parameters: {
            time: {
              minutes: '{{count}} mins.',
              seconds: '{{count}} seg.',
            },
            speed: 'vel. {{speed}}',
            reversed: 'giro a la izquierda'
          }
        },
        tips: 'Consejos',
        usefulItems: {
          heading: 'Elementos Útiles',
          notes: 'Notas',
        },
      },
      cookingGuide: {
        start: '¡Cocinar hoy!',
        intro: {
          greeting: "¡Qué rica receta vamos a cocinar hoy!",
          miseEnPlace: {
            one: "Lo primero es hacer nuestro",
            two: "\nmise en place\n",
            three: "preparando todos los ingredientes que vamos a necesitar."
          },
          checkboxSteps: {
            checkmark: "Dale palomita ",
            steps: "a cada ingrediente que tengas listo, y luego haz click en 'siguiente' para el próximo paso.",
          }
        },
        navigation: {
          step: 'Paso {{step}} de {{total}}',
          finish: '¡Terminar!',
          next: 'Siguiente',
          back: 'Atrás'
        },
        miseEnPlace: {
          ingredients: {
            heading: 'Ingredientes',
          },
          usefulItems: {
            heading: 'Elementos Útiles',
          }
        }
      },
      share: {
        message: '¡Mira esta receta en YummyYummix!',
      }
    },
    onboarding: {
      common: {
        next: 'Siguiente',
        back: 'Atrás',
        skip: 'Omitir',
        finish: 'Finalizar',
        addAnother: 'Agregar Otra',
        remove: 'Eliminar',
      },
      steps: {
        welcome: {
          title: "¡Te damos la bienvenida a YummyYummix!",
          subtitle: "Para empezar a usar tu cuenta, cuéntanos un poco sobre ti.",
          start: "¡Empezar!",
        },
        name: {
          title: "¿Cómo te llamas?",
          subtitle: "Nos encantaría saber con quién cocinamos.",
          placeholder: "Escribe tu nombre aquí"
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
            other: "Otra (especificar)"
          },
          otherPlaceholder: 'Por favor, especifica tu alergia',
        },
        diet: {
          title: "¿Sigues algún tipo de alimentación particular?",
          subtitle: "Cuéntanos tus preferencias para sugerirte recetas adaptadas a ti.",
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
            other: "Otra (especificar)"
          },
          otherPlaceholder: 'Por favor, especifica tu dieta',
        },
        appPreferences: {
          title: "Tus Preferencias",
          subtitle: "Elige tu idioma y sistema de medidas",
          language: "Idioma",
          measurementSystem: "Unidades",
          measurements: {
            metric: {
              title: "Métrico",
              examples: "(g, ml, cm)"
            },
            imperial: {
              title: "Imperial",
              examples: "(oz, tazas, in)"
            }
          }
        },
      }
    },
    validation: {
      required: 'Este campo es obligatorio',
      nameMinLength: 'El nombre debe tener al menos 2 caracteres',
      nameMaxLength: 'El nombre debe tener menos de 50 caracteres',
      otherAllergyRequired: 'Por favor, especifica tu alergia',
      otherDietRequired: 'Por favor, especifica tu dieta',
      missingValue: 'Por favor ingresa un valor antes de agregar otro',
      number: 'Debe ser un número',
      minValue: 'El valor mínimo es {{min}}',
      maxValue: 'El valor máximo es {{max}}',
      minMaxValue: 'El valor debe estar entre {{min}} y {{max}}',
      decimalValue: 'Solo se permite el decimal .5',
      endSpeedGreaterThanStart: 'La velocidad final debe ser mayor o igual a la velocidad inicial',
    },
    profile: {
      title: 'Perfil',
      greeting: '¡Hola!',
      editProfile: 'Edita tu perfil',
      personalInfo: 'Información Personal',
      settings: 'Configuración',
      uploadImage: 'Subir Imagen',
      name: 'Nombre',
      namePlaceholder: 'Ingresa tu nombre',
      bio: 'Biografía',
      bioPlaceholder: 'Cuéntanos sobre ti',
      save: 'Guardar Cambios',
      features: {
        planner: 'Mi planificador',
        recipes: 'Mis recetas',
        shoppingList: 'Mi lista de compras',
        achievements: 'Mis cursos y logros'
      },
      logout: 'Cerrar sesión',
      changePhoto: 'Cambiar foto',
      configurePersonalData: 'Configurar datos personales',
      username: 'Nombre de usuario',
      language: 'Idioma',
      measurementSystem: 'Sistema de medidas',
      deleteAccount: 'Eliminar cuenta',
      deleteAccountFlow: {
        title: 'Eliminar cuenta',
        warning: 'Este paso es irreversible. Una vez que tu cuenta es eliminada se perderán todos tus datos sin posibilidad de recuperación.',
        confirmQuestion: '¿Aún deseas eliminar tu cuenta?',
        cancel: 'Cancelar',
        delete: 'Eliminar cuenta',
        feedback: {
          title: 'Antes de irte',
          subtitle: 'Nos gustaría saber por qué. Tu opinión nos ayuda a mejorar y ofrecer una mejor experiencia.',
          selectReason: 'Por favor, selecciona todas las razones que apliquen:',
          reasons: {
            noUse: 'Ya no uso la app',
            technical: 'Problemas técnicos',
            foundBetter: 'Encontré otra app que prefiero',
            other: 'Otra razón'
          },
          tellUsMore: 'Por favor cuéntanos más acerca de tu experiencia.',
          finalConfirmation: {
            title: 'Confirmación Final',
            message: '¿Estás completamente seguro de que deseas eliminar tu cuenta? Esta acción no se puede deshacer.',
            cancel: 'Mantener Mi Cuenta',
            confirm: 'Sí, Eliminar Mi Cuenta'
          },
          requestReceived: {
            title: 'Solicitud Recibida',
            message: 'Hemos recibido tu solicitud de eliminación de cuenta. Por motivos de seguridad, este proceso se completará en un plazo de 14 días. Durante este tiempo, puedes cancelar la eliminación iniciando sesión nuevamente y contactando a nuestro equipo de soporte.',
            ok: 'Aceptar'
          }
        }
      },
      personalData: {
        title: 'Datos Personales',
        gender: 'Género',
        genderOptions: {
          male: 'Masculino',
          female: 'Femenino',
          other: 'Otro',
          preferNotToSay: 'Prefiero no decir'
        },
        birthDate: 'Fecha de nacimiento',
        height: 'Altura',
        weight: 'Peso',
        activityLevel: 'Nivel de actividad',
        activityLevelOptions: {
          sedentary: 'Sedentario',
          lightlyActive: 'Ligeramente activo',
          moderatelyActive: 'Moderadamente activo',
          veryActive: 'Muy activo',
          extraActive: 'Super activo'
        },
        dietaryRestrictions: 'Tipo de alimentación',
        updateDietaryRestrictions: 'Actualizar tipo de alimentación',
        heightPlaceholder: 'Ingresa tu altura',
        weightPlaceholder: 'Ingresa tu peso',
        cm: 'cm',
        kg: 'kg',
        lb: 'lb',
        ft: 'pies',
        in: 'pulg',
        diet: 'Dieta',
        dietTypes: {
          none: 'Sin dieta específica',
          vegetarian: 'Vegetariana',
          vegan: 'Vegana',
          pescatarian: 'Pescetariana',
          paleo: 'Paleo',
          keto: 'Keto',
          glutenFree: 'Sin gluten',
          dairyFree: 'Sin lácteos',
          other: 'Otra'
        },
        allergies: 'Alergias',
        allergyTypes: {
          none: 'Sin alergias',
          peanuts: 'Cacahuetes',
          treeNuts: 'Frutos secos',
          dairy: 'Lácteos',
          eggs: 'Huevos',
          soy: 'Soja',
          wheat: 'Trigo',
          fish: 'Pescado',
          shellfish: 'Mariscos',
          other: 'Otra'
        },
        otherDietPlaceholder: 'Ingresa tu dieta',
        otherAllergyPlaceholder: 'Ingresa tu alergia',
        addAnother: 'Agregar otro'
      }
    },
    admin: {
      common: {
        dashboard: 'Panel de Control',
        recipes: 'Recetas',
        ingredients: 'Ingredientes',
        tags: 'Etiquetas',
        users: 'Usuarios',
        settings: 'Configuración',
        actions: 'Acciones',
        loading: 'Cargando...',
        image: 'Imagen',
        changeImage: 'Cambiar Imagen',
        uploadImage: 'Subir Imagen',
      },
      recipes: {
        list: {
          title: 'Recetas',
          createButton: 'Crear Receta',
          search: 'Buscar recetas...',
          noRecipes: 'No se encontraron recetas',
          published: 'Publicada',
          draft: 'Borrador',
          view: 'Ver',
          edit: 'Editar',
          delete: 'Eliminar',
          filters: {
            all: 'Todas las Recetas',
            published: 'Publicadas',
            drafts: 'Borradores',
          },
          deleteConfirm: {
            title: 'Eliminar Receta',
            message: '¿Estás seguro de que deseas eliminar esta receta? Esta acción no se puede deshacer.',
            cancel: 'Cancelar',
            confirm: 'Eliminar',
          },
        },
        create: {
          title: 'Crear Receta',
          success: 'Receta creada exitosamente',
          getStarted: 'Vamos a Crear una Receta',
          chooseOption: 'Elige cómo quieres comenzar a crear tu nueva receta',
          populateWithAI: 'Rellenar con IA',
          startFromScratch: 'Comenzar desde Cero',
        },
        edit: {
          title: 'Editar Receta',
          success: 'Receta actualizada exitosamente',
        },
        resume: {
          title: 'Continuar Receta Guardada',
          message: 'Tienes una receta guardada. ¿Te gustaría continuar donde lo dejaste?',
          continue: 'Continuar Borrador',
          startNew: 'Comenzar Nueva Receta',
          untitledRecipe: 'Receta Sin Título'
        },
        form: {
          initialSetup: {
            populateRecipe: 'Rellenar Receta',
            pasteHere: 'Pega tu receta aquí...',
            missingIngredients: 'Ingredientes Faltantes',
            missingTags: 'Etiquetas Faltantes',
            createIngredient: 'Crear Ingrediente',
            createTag: 'Crear Etiqueta',
            missingUsefulItems: 'Elementos Útiles Faltantes',
            createUsefulItem: 'Crear Elemento Útil',
            continueRecipe: 'Continuar Receta',
          },
          basicInfo: {
            title: 'Información Básica',
            nameEnglish: 'Nombre',
            nameSpanish: 'Nombre en Español',
            description: 'Descripción',
            descriptionSpanish: 'Descripción en Español',
            preparationTime: 'Tiempo de Preparación',
            cookingTime: 'Tiempo de Cocción',
            servings: 'Porciones',
            difficulty: 'Dificultad',
            category: 'Categoría',
            difficultyPlaceholder: 'Seleccionar Dificultad',
            portions: 'Porciones',
            prepTime: 'Tiempo de Preparación (minutos)',
            totalTime: 'Tiempo Total (minutos)',
            usefulItemsEnglish: 'Elementos Útiles (Inglés)',
            usefulItemsSpanish: 'Elementos Útiles (Español)',
            tipsAndTricksEnglish: 'Consejos & Trucos (Inglés)',
            tipsAndTricksSpanish: 'Consejos & Trucos (Español)',
            recipeImage: 'Imagen de la Receta',
            changeImage: 'Cambiar Imagen',
            mainImage: 'Imagen Principal',
            uploadImage: 'Subir Imagen Principal',
          },
          ingredientsInfo: {
            title: 'Ingredientes',
            description: 'Busca ingredientes y añádelos a tu receta. Puedes especificar cantidades, unidades y notas para cada ingrediente.',
            searchPlaceholder: 'Buscar ingredientes...',
            selectedIngredients: 'Ingredientes Seleccionados',
            itemsSelected: 'elementos',
            noIngredientsFound: 'No se encontraron ingredientes',
            createNewIngredient: 'Crear Nuevo Ingrediente',
            addIngredient: 'Añadir Ingrediente',
            editIngredient: 'Editar Ingrediente',
            removeIngredient: 'Eliminar Ingrediente',
            noIngredientsSelected: 'No hay ingredientes seleccionados',
            selectFromLeft: 'Usa la búsqueda de la izquierda para encontrar y añadir ingredientes',
            selectIngredient: 'Seleccionar ingrediente',
            noSearchResults: 'Ningún ingrediente coincide con tu búsqueda',
            noIngredients: 'No hay ingredientes disponibles',
            editTitle: 'Editar Ingrediente',
            addTitle: 'Añadir Ingrediente',
            details: 'Detalles del Ingrediente',
            quantity: 'Cantidad',
            quantityPlaceholder: 'ej. 1, 2, 0.5',
            measurementUnit: 'Unidad de Medida',
            measurementUnitPlaceholder: 'Selecciona una unidad de medida',
            optional: 'Opcional',
            quantityTitle: 'Cantidad',
            notes: 'Notas',
            notesTitle: 'Notas',
            notesEn: 'Notas (Inglés)',
            notesEs: 'Notas (Español)',
            notesEnPlaceholder: 'Información adicional sobre este ingrediente (Inglés)',
            notesEsPlaceholder: 'Información adicional sobre este ingrediente (Español)',
            notesHelperText: 'Aparece entre paréntesis junto al nombre del ingrediente',
            tipTitle: 'Consejos',
            tipEn: 'Consejo (Inglés)',
            tipEs: 'Consejo (Español)',
            recipeSectionEn: 'Sección de la Receta (Inglés)',
            recipeSectionEs: 'Sección de la Receta (Español)',
            addToRecipe: 'Agregar a la receta',
          },
          usefulItemsInfo: {
            title: 'Elementos Útiles',
            description: 'Busca elementos útiles y añádelos a tu receta. Puedes reordenarlos para mostrar primero los más importantes.',
            searchPlaceholder: 'Buscar elementos útiles...',
            createNew: 'Crear Nuevo',
            selectedHeader: 'Elementos Útiles Seleccionados',
            selectedCount: '{{count}} elementos',
            noSelectedItems: 'No hay elementos útiles seleccionados',
            noUsefulItems: 'No hay elementos útiles disponibles',
            noSearchResults: 'Ningún elemento útil coincide con tu búsqueda',
            editItem: 'Editar Elemento Útil',
            addItem: 'Añadir Elemento Útil',
            duplicateError: 'Este elemento útil ya está añadido a la receta',
            fetchError: 'Error al cargar elementos útiles',
            errorTitle: 'Error',
            notesEnLabel: 'Notas (Inglés)',
            notesEsLabel: 'Notas (Español)',
          },
          stepsInfo: {
            title: 'Instrucciones',
            addStep: 'Agregar Paso',
            editStep: 'Editar Paso',
            updateStep: 'Actualizar Paso',
            removeStep: 'Eliminar Paso',
            tipTitle: 'Consejos',
            tipEn: 'Consejo para esta receta (Inglés)',
            tipEs: 'Consejo para esta receta (Español)',
            recipeSectionEn: 'Sección de la Receta (Inglés)',
            recipeSectionEs: 'Sección de la Receta (Español)',
            instructionHeadingEn: 'Instrucción (Inglés)',
            instructionHeadingEs: 'Instrucción (Español)',
            thermomixParameters: 'Parámetros de Thermomix',
            thermomixTime: 'Tiempo',
            minutes: 'min',
            seconds: 'seg',
            thermomixSpeed: 'Velocidad',
            thermomixIsBladeReversed: 'giro a la izquierda',
            thermomixTemperature: 'Temperatura',
            thermomixHelperText: 'Agregar configuraciones de Thermomix si este paso requiere usar una Thermomix',
            thermomixParamsFormat: 'Agregar %thermomix% para incluir las configuraciones de Thermomix en el paso',
            stepIngredients: 'Ingredientes',
            stepIngredientsHelperText: 'Seleccionar qué ingredientes se usan en este paso',
            images: 'Imágenes de Pasos',
            uploadImage: 'Subir Imagen de Paso',
            textFormattingHelp: 'Ayuda de Formato de Texto',
            boldText: 'Texto en Negrita',
            boldTextDescription: 'Agregue **texto** para ponerlo en negrita',
            newLine: 'Nueva Línea',
            newLineDescription: 'Agregue | para iniciar una nueva línea',
            thermomixParams: 'Configuraciones Thermomix',
            thermomixParamsDescription: 'Incluya %thermomix% donde deben aparecer las configuraciones',
            bulletPoint: 'Punto de Viñeta',
            bulletPointDescription: 'Use {•}texto{/•} para crear elementos con viñetas',
            noSteps: 'Aún no hay pasos agregados',
            addStepPrompt: 'Haz clic en "Agregar Paso" para comenzar a crear instrucciones de receta',
            noStepText: 'No se proporcionó texto de instrucción',
            instruction: 'Instrucción',
            recipeSection: 'Sección de la Receta',
            singleSpeed: 'Velocidad Única',
            speedRange: 'Rango de Velocidad',
            speedStart: 'Velocidad Inicial',
            speedEnd: 'Velocidad Final',
            available: 'Disponible'
          },
          tagsInfo: {
            title: 'Etiquetas',
            searchTags: 'Buscar etiquetas...',
            selectedTags: 'Etiquetas Seleccionadas',
            noTagsSelected: 'No se han seleccionado etiquetas',
            availableTags: 'Etiquetas Disponibles',
            noTagsFound: 'No se encontraron etiquetas',
            selectCategories: 'Filtrar por categorías',
            spanishName: 'Nombre en Español',
            englishName: 'Nombre en Inglés',
            categories: 'Categorías',
            allCategories: 'Todas las Categorías',
            clearFilters: 'Limpiar filtros'
          },
          reviewInfo: {
            title: 'Revisión',
            reviewHelperText: 'Revisa tu receta antes de publicar',
            ingredients: 'Ingredientes',
            steps: 'Instrucciones',
            tags: 'Etiquetas',
            usefulItems: 'Elementos Útiles',
            publish: 'Publicar Receta',
            noTagsFound: 'No se encontraron etiquetas',
          },
          tabs: {
            details: 'Detalles',
            ingredients: 'Ingredientes',
            steps: 'Instrucciones',
            tags: 'Etiquetas',
            review: 'Revisión',
          },
          saveRecipe: 'Guardar Receta',
          save: 'Guardar',
          cancel: 'Cancelar',
          draft: 'Borrador',
          published: 'Publicada',
          status: 'Estado',
          publishRecipe: 'Publicar Receta',
          unpublishRecipe: 'Despublicar Receta',
          deleteRecipe: 'Eliminar Receta',
          backToList: 'Volver a Lista',
          createRecipe: 'Crear Receta',
          updateRecipe: 'Actualizar Receta',
          manage: 'Administrar',
          publish: 'Publicar',
          saveAsDraft: 'Guardar como Borrador',
          minutes: 'minutos',
          hour: 'hora',
          hours: 'horas',
          easy: 'Fácil',
          medium: 'Medio',
          hard: 'Difícil',
          ingredient: 'Ingrediente',
          errors: {
            nameRequired: 'El nombre de la receta es requerido en al menos un idioma',
            difficultyRequired: 'La dificultad es requerida',
            prepTimeRequired: 'El tiempo de preparación es requerido',
            totalTimeRequired: 'El tiempo total es requerido',
            portionsRequired: 'El número de porciones es requerido',
            ingredientsRequired: 'Se requiere al menos un ingrediente',
            stepsRequired: 'Se requiere al menos un paso',
            imageRequired: 'La imagen de la receta es requerida',
            saveFailed: 'Error al guardar la receta',
            loadFailed: 'Error al cargar la receta'
          },
          saveSuccess: {
            title: 'Receta Guardada',
            message: 'Tu receta ha sido guardada exitosamente'
          },
          saveError: {
            title: 'Error al Guardar la Receta',
            message: 'Hubo algunos errores en tu receta. Por favor revisa los campos resaltados e intenta de nuevo.'
          }
        },
        errors: {
          nameRequired: 'Se requiere el nombre de la receta en al menos un idioma',
          difficultyRequired: 'Se requiere la dificultad',
          prepTimeRequired: 'Se requiere el tiempo de preparación',
          totalTimeRequired: 'Se requiere el tiempo total',
          portionsRequired: 'Se requiere el número de porciones',
          ingredientsRequired: 'Se requiere al menos un ingrediente',
          stepsRequired: 'Se requiere al menos un paso',
          imageRequired: 'Se requiere una imagen de la receta',
          publishFailed: 'La receta no se pudo publicar.'
        },
      },
      ingredients: {
        editTitle: 'Editar Ingrediente',
        createTitle: 'Crear Ingrediente',
        nameEn: 'Name (English)',
        nameEs: 'Name (Spanish)',
        pluralNameEn: 'Plural Name (English)',
        pluralNameEs: 'Plural Name (Spanish)',
        image: 'Ingredient Image',
        uploadImage: 'Upload Image',
        changeImage: 'Cambiar Imagen',
        translations: 'Translations',
        nutritionalFacts: {
          title: 'Información Nutricional',
          subtitle: 'Valores por 100g de ingrediente',
          roundingRules: 'Redondea las calorías a números enteros. Redondea proteínas, grasas y carbohidratos a un decimal.',
          calories: 'Calorías',
          protein: 'Proteína',
          fat: 'Grasa',
          carbs: 'Carbohidratos',
          autoFillButton: 'Auto-detectar Valores Nutricionales',
          errors: {
            noIngredient: 'Por favor ingrese un nombre de ingrediente antes de auto-detectar los valores nutricionales',
            fetchFailed: 'No se pudieron obtener los valores nutricionales. Por favor intenta de nuevo o ingresa los valores manualmente.'
          },
          unit: {
            calories: 'kcal',
            grams: 'g'
          },
          validation: {
            required: 'This field is required',
            invalidNumber: 'Please enter a valid number',
            minValue: 'Value must be greater than or equal to 0'
          }
        },
        success: {
          title: 'Success',
          createSuccessMessage: 'Ingredient created successfully',
          updateSuccessMessage: 'Ingredient updated successfully'
        },
        confirmDeletion: {
          title: 'Confirm Deletion',
          message: 'Are you sure you want to delete this ingredient? This action cannot be undone.'
        },
        errors: {
          title: 'Error',
          validationFailed: 'Please check the form for errors',
          createFailed: 'Failed to create ingredient'
        }
      },
      tags: {
        searchPlaceholder: 'Buscar etiquetas...',
        addNew: 'Agregar Etiqueta',
        createTitle: 'Crear Nueva Etiqueta',
        editTitle: 'Editar Etiqueta',
        englishName: 'Nombre en Inglés',
        spanishName: 'Nombre en Español',
        englishNamePlaceholder: 'Ingrese nombre de etiqueta en Inglés',
        spanishNamePlaceholder: 'Ingrese nombre de etiqueta en Español',
        categories: 'Categorías',
        basicInfo: 'Información Básica',
        selectedCategories: 'Categorías Seleccionadas',
        noSelectedCategories: 'Aún no hay categorías seleccionadas',
        searchCategories: 'Buscar categorías...',
        availableCategories: 'Categorías Disponibles',
        noCategoriesFound: 'No se encontraron categorías',
        deleteTitle: 'Eliminar Etiqueta',
        deleteMessage: '¿Está seguro que desea eliminar esta etiqueta? Esta acción no se puede deshacer.',
        noTagsFound: 'No se encontraron etiquetas',
        addNewCategory: 'Agregar Nueva Categoría',
        newCategoryTitle: 'Agregar Nueva Categoría',
        categoryNamePlaceholder: 'Ingrese nombre de categoría',
        categoryCreated: 'Categoría creada exitosamente',
      },
      usefulItems: {
        title: 'Administrar Artículos Útiles',
        searchPlaceholder: 'Buscar artículos útiles...',
        createNew: 'Nuevo Artículo Útil',
        noItemsFound: 'No se encontraron artículos útiles',
        confirmDeletion: {
          title: 'Confirmar Eliminación',
          message: '¿Estás seguro de que deseas eliminar {{nameEn}} | {{nameEs}}?'
        },
        errors: {
          title: 'Error',
          deleteFailed: 'No se pudo eliminar el artículo útil',
          saveFailed: 'No se pudo guardar el artículo útil'
        },
        form: {
          createTitle: 'Crear Artículo Útil',
          editTitle: 'Editar Artículo Útil',
          imageTitle: 'Imagen del Artículo',
          detailsTitle: 'Detalles del Artículo',
          nameEn: 'Nombre (Inglés)',
          nameEs: 'Nombre (Español)',
          nameEnPlaceholder: 'Ingrese el nombre del artículo en inglés',
          nameEsPlaceholder: 'Ingrese el nombre del artículo en español',
          errors: {
            nameEnRequired: 'El nombre en inglés es obligatorio',
            nameEsRequired: 'El nombre en español es obligatorio',
            imageRequired: 'La imagen es obligatoria'
          }
        }
      },
    },
    chat: {
      title: 'Irmixy',
      greeting: '¡Hola! Soy Irmixy, tu asistente de cocina con IA. ¡Pregúntame lo que quieras sobre cocina!',
      inputPlaceholder: 'Pregúntame lo que quieras sobre cocina...',
      sendButton: 'Enviar',
      error: 'Lo siento, algo salió mal. Por favor, inténtalo de nuevo.',
      loginRequired: 'Por favor, inicia sesión para chatear con Irmixy.',
      voice: {
        listening: '¡Te escucho!',
        thinking: 'Pensando...',
        speaking: '¡Hablando!',
        tapToSpeak: 'Toca para hablar',
        tapToStop: 'Toca para detener',
        handsFreeModeActive: 'Modo manos libres - Pararé cuando termines de hablar',
        permissionRequired: 'Se requiere permiso del micrófono',
        couldNotUnderstand: 'No pude entender el audio',
        hearing: 'Escuchándote...',
        silenceDetected: 'Silencio detectado',
        waitingForSpeech: 'Esperando que hables...',
      },
    },
  }
};

const i18n = new I18n(translations);

// Set a default locale - the actual locale will be set by the LanguageProvider
i18n.locale = 'en';

// When a value is missing from a language it'll fall back to another language with the key present.
i18n.enableFallback = true;

export default i18n; 