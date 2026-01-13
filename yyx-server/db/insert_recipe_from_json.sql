SELECT * FROM insert_recipe_from_json('
{
  "name": "Sopa Verde",
  "steps": [
    {
      "section": "Main",
      "order": 1,
      "instruction": "Añade el ajo, la cebolla y el aceite al vaso de tu Thermomix® y pica **3 seg./vel. 5**.",
      "time": 3,
      "speed": 5
    },
    {
      "section": "Main",
      "order": 2,
      "instruction": "Baja los restos de las paredes del vaso y sofríe **5 mins. / 120ºC / vel. 1**.",
      "time": 300,
      "speed": 1,
      "temperature": 120
    },
    {
      "section": "Main",
      "order": 3,
      "instruction": "Añade las calabacitas en trozos al vaso de tu Thermomix®, pica **5 seg. / vel. 5**.",
      "time": 5,
      "speed": 5
    },
    {
      "section": "Main",
      "order": 4,
      "instruction": "Baja los restos de las paredes del vaso y sofríe **7 mins. / 120ºC / vel. 1**.",
      "time": 420,
      "speed": 1,
      "temperature": 120
    },
    {
      "section": "Main",
      "order": 5,
      "instruction": "Agrega el agua, la sal y pimienta y cocina por **12 mins. / 100ºC / vel. 1**.",
      "time": 720,
      "speed": 1,
      "temperature": 100
    },
    {
      "section": "Main",
      "order": 6,
      "instruction": "Añade el espinaca y cocina por otros **3 mins. / 100ºC / vel. 2**.",
      "time": 180,
      "speed": 2,
      "temperature": 100
    },
    {
      "section": "Main",
      "order": 7,
      "instruction": "Dale un toque cremosito a tu sopa licuando **1 min.** incrementando progresivamente **vel. 4-8**",
      "time": 60,
      "speed": 4
    }
  ],
  "display_picture_url": "",
  "difficulty": "fácil",
  "prep_time": 20,
  "total_time": 90,
  "portions": "4 porciones",
  "useful_items": "",
  "nutritional_facts": {},
  "tips_and_tricks": "Acompaña tu sopita con crutones, quesito feta ó tu queso favorito.",
  "tags": [
    "Sopa",
    "Vegetariano",
    "Saludable",
    "Entrada",
    "Rápido"
  ],
  "ingredients": [
    {
      "name": "cebolla",
      "plural_name": "cebollas",
      "quantity": 150,
      "unit": "g",
      "notes": "",
      "component": "Main",
      "display_order": 1,
      "optional": false
    },
    {
      "name": "espinaca",
      "plural_name": "espinacas",
      "quantity": 50,
      "unit": "g",
      "notes": "",
      "component": "Main",
      "display_order": 2,
      "optional": false
    },
    {
      "name": "calabacita",
      "plural_name": "calabacitas",
      "quantity": 800,
      "unit": "g",
      "notes": "",
      "component": "Main",
      "display_order": 3,
      "optional": false
    },
    {
      "name": "ajo",
      "plural_name": "ajos",
      "quantity": 2,
      "unit": "dientes",
      "notes": "",
      "component": "Main",
      "display_order": 4,
      "optional": false
    },
    {
      "name": "agua",
      "plural_name": "agua",
      "quantity": 400,
      "unit": "g",
      "notes": "",
      "component": "Main",
      "display_order": 5,
      "optional": false
    },
    {
      "name": "sal y pimienta",
      "plural_name": "sal y pimienta",
      "quantity": 1,
      "unit": "al gusto",
      "notes": "",
      "component": "Main",
      "display_order": 6,
      "optional": false
    }
  ]
}

'::jsonb);
