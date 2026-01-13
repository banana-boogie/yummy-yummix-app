BEGIN;

-- Create index for faster recipe ingredient lookups
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_id_idx ON recipe_ingredients (recipe_id);
CREATE INDEX IF NOT EXISTS recipe_ingredients_ingredient_id_idx ON recipe_ingredients (ingredient_id);

-- Panqué de nuez glaseado
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
-- Bizcocho components
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'nuez'),
  80, 'g',
  'main',
  'Bizcocho',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
  170, 'g',
  'sin sal, en trozos a temperatura ambiente',
  'Bizcocho',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar moscabada'),
  230, 'g',
  'main',
  'Bizcocho',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'huevo'),
  2, 'unidad',
  'main',
  'Bizcocho',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'leche'),
  100, 'g',
  'main',
  'Bizcocho',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'harina de trigo'),
  190, 'g',
  'main',
  'Bizcocho',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'polvo para hornear'),
  1, 'cdta',
  'main',
  'Bizcocho',
  7
),

-- Glaseado components
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'nuez'),
  50, 'g',
  'main',
  'Glaseado',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar moscabada'),
  100, 'g',
  'main',
  'Glaseado',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
  20, 'g',
  'main',
  'Glaseado',
  10
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jarabe de maple'),
  40, 'g',
  'main',
  'Glaseado',
  11
);


-- Nieve rápida de fruta
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Nieve rápida de fruta' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar'),
  180, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jugo de limón'),
  10, 'g',
  'recién exprimido',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mango'),
  100, 'g',
  'en trozos',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'fresa'),
  100, 'g',
  'en trozos',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'piña'),
  100, 'g',
  'en trozos',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'hielo'),
  1000, 'g',
  NULL,
  'main',
  6
);


-- Galletas de mantequilla
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Galletas de mantequilla' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'harina de trigo'),
  250, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar'),
  100, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
  100, 'g',
  'sin sal, en trozos',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'huevo'),
  1, 'unidad',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'polvo para hornear'),
  1, 'cdta',
  NULL,
  'main',
  5
);

-- Flan de queso crema
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Flan de queso crema' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caramelo líquido'),
  70, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'leche condensada'),
  370, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'leche evaporada'),
  390, 'g',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'huevo'),
  5, 'unidad',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'vainilla'),
  1, 'cda',
  NULL,
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso crema'),
  190, 'g',
  NULL,
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  1500, 'g',
  NULL,
  'main',
  7
);

-- Recipe: Pan de leche
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Pan de leche' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'leche'),
  300, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
  50, 'g',
  'en trozos',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'levadura prensada fresca'),
  20, 'g',
  'desmenuzada',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar'),
  60, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'harina de trigo'),
  550, 'g',
  NULL,
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cdta',
  'rasa',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'huevo'),
  1, 'unidad',
  'batido, para barnizar',
  'main',
  7
);

-- Recipe: Pan de caja blanco
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Pan de caja blanco' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua mineral'),
  512, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar'),
  36, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla'),
  24, 'g',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'levadura seca instantánea'),
  15, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'harina de trigo'),
  746, 'g',
  NULL,
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  12, 'g',
  NULL,
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
  24, 'g',
  'para engrasar el molde',
  'main',
  7
);

-- Recipe: Bolillos caseros
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Bolillos caseros' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  300, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'levadura seca instantánea'),
  10, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'harina de trigo'),
  500, 'g',
  'y un poco más para trabajar',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  10, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar'),
  10, 'g',
  NULL,
  'main',
  5
);

-- Recipe: Baguette
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Baguette' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  330, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'levadura prensada fresca'),
  10, 'g',
  'desmenuzada',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  5, 'ml',
  'para engrasar',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'harina de trigo'),
  500, 'g',
  'y un poco más para trabajar',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cdta',
  'rasa',
  'main',
  5
);

-- Recipe: Piña colada
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Piña colada' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'hielo'),
  500, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'piña'),
  350, 'g',
  'fresca en trozos (reserve 6 gajos pequeños para decorar)',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar'),
  150, 'g',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'leche de coco'),
  400, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ron'),
  100, 'g',
  '100g-200g',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  100, 'ml',
  'para decorar las copas',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'coco rallado'),
  100, 'g',
  'para decorar las copas',
  'main',
  7
);

-- Recipe: Mojito
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Mojito' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'hielo'),
  400, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'lima'),
  4, 'unidad',
  'cortadas en cuartos',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar'),
  150, 'g',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ron blanco'),
  240, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'menta fresca'),
  4, 'ramitas',
  'solo las hojas',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'soda'),
  240, 'g',
  NULL,
  'main',
  6
);

-- Recipe: Margarita de sandía y mango
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Margarita de sandía y mango' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jugo de limón'),
  45, 'g',
  'recién exprimido',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mango'),
  170, 'g',
  'sólo la pulpa (1 pieza grande aprox.)',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sandía'),
  210, 'g',
  'sólo la pulpa, sin semillas',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar'),
  80, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'tequila'),
  80, 'g',
  NULL,
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cdta',
  NULL,
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'hielo'),
  460, 'g',
  NULL,
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'limón'),
  1, 'unidad',
  NULL,
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chamoy'),
  '10', 'g',
  'en polvo',
  'main',
  9
);

-- Recipe: Limonada
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Limonada' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'limón'),
  3, 'unidad',
  'enteros',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  1000, 'g',
  'fría',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar'),
  100, 'g',
  'o al gusto',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'hielo'),
  10, 'unidad',
  NULL,
  'main',
  4
);

-- Recipe: Horchata de semillas de melón
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Horchata de semillas de melón' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'semillas de melón'),
  200, 'g',
  'de 1 melón',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar'),
  150, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  1000, 'g',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'canela'),
  1, 'cdta',
  'en polvo',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'hielo'),
  10, 'unidad',
  'para servir',
  'main',
  5
);

-- Recipe: Detox verde
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Detox verde' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  500, 'g',
  'fria',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'manzana verde'),
  1, 'unidad',
  'en cuartos, sin semillas',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'kale'),
  50, 'g',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pepino'),
  30, 'g',
  'pelado, sin semillas',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'apio'),
  2, 'ramitas',
  NULL,
  'main',
  5
);

-- Recipe: Rajas con queso
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Rajas con queso' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso chihuahua'),
  150, 'g',
  'cortado en trozos',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  50, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'granos de elote'),
  185, 'g',
  'frescos',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  15, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile poblano'),
  220, 'g',
  'asado, pelado, sin semillas y cortado trozos',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cdta',
  'o al gusto',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'crema ácida'),
  150, 'g',
  NULL,
  'main',
  7
);

-- Recipe: Cazuela de panela con espinacas y caldillo
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Cazuela de panela con espinacas y caldillo' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  150, 'g',
  'en trozos',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  2, 'dientes',
  'pelados',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate'),
  600, 'g',
  'en mitades',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  30, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cdta',
  'fina, o al gusto',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  1, 'cdta',
  'molida, o al gusto',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'comino'),
  1, 'pizca',
  'opcional',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'espinaca fresca'),
  200, 'g',
  'sin tallos',
  'main',
  8
);

-- Recipe: Calabacitas con elote y cilantro
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Calabacitas con elote y cilantro' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cilantro'),
  10, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  80, 'g',
  'en trozos',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  1, 'diente',
  'pelado',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite de oliva'),
  25, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'granos de elote'),
  235, 'g',
  'blanco, en latado y escurrido',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'calabacita'),
  400, 'g',
  'en cubos de (2 cm)',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'puré de tomate'),
  135, 'g',
  NULL,
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cdta',
  'fina, o al gusto',
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  1, 'cdta',
  'molida, o al gusto',
  'main',
  9
);

-- Recipe: Broccolini crujiente con salsa de ajos
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Broccolini crujiente con salsa de ajos' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar moreno'),
  10, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  50, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite de oliva'),
  40, 'g',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'broccolini'),
  500, 'g',
  'cortados en 2-3 trozos',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'vino blanco'),
  50, 'g',
  NULL,
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'salsa de soja'),
  50, 'g',
  NULL,
  'main',
  6
);

-- Recipe: Salpicón de res
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Salpicón de res' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'lechuga romana'),
  300, 'g',
  'en trozo',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  2300, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'vinagre de vino blanco'),
  50, 'g',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite de oliva'),
  30, 'g',
  'extra virgen',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cdta',
  'fina, o al gusto',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  1, 'cdta',
  'molida, o al gusto',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'falda de res'),
  500, 'g',
  'en trozos de 4 cm',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  60, 'g',
  'blanca, en trozos',
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  1, 'diente',
  'pelado',
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate'),
  2, 'unidad',
  'saladet, sin semillas y cortados en tiras',
  'main',
  10
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla morada'),
  40, 'g',
  'cortada en rebanadas finas',
  'main',
  11
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aguacate'),
  1, 'unidad',
  NULL,
  'main',
  12
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'tostadas'),
  10, 'unidad',
  NULL,
  'main',
  13
);

-- Recipe: Tinga de pollo
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Tinga de pollo' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  300, 'g',
  'en gajos o julianas (1 cm)',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  30, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate guaje'),
  500, 'g',
  'en cuartos',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pechuga de pollo'),
  1000, 'g',
  'deshuesada y sin piel, en trozos',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caldo de pollo'),
  2, 'cubos',
  'o al gusto',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile chipotle adobado'),
  30, 'g',
  'o al gusto',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'laurel'),
  2, 'hojas',
  'secas',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'tostadas'),
  18, 'unidad',
  'para servir',
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'crema ácida'),
  250, 'g',
  'para servir',
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso panela'),
  200, 'g',
  'para servir',
  'main',
  10
);

-- Recipe: Pollo con mole
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Pollo con mole' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile mulato'),
  4, 'unidad',
  'desvenados',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile ancho'),
  2, 'unidad',
  'desvenados',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile chipotle'),
  2, 'unidad',
  'seco, desvenados',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'romero'),
  1, 'rama',
  'sólo las hojas',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'tomillo'),
  1, 'rama',
  'sólo las hojas',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta gorda'),
  2, 'unidad',
  NULL,
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajonjolí'),
  20, 'g',
  NULL,
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'canela'),
  0.5, 'cdta',
  NULL,
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'almendra'),
  20, 'g',
  NULL,
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pepita de calabaza'),
  20, 'g',
  NULL,
  'main',
  10
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cacahuate'),
  20, 'g',
  'tostados sin sal',
  'main',
  11
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  50, 'g',
  NULL,
  'main',
  12
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  2, 'dientes',
  'pelados',
  'main',
  13
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate'),
  200, 'g',
  'en trozos',
  'main',
  14
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pasas'),
  20, 'g',
  NULL,
  'main',
  15
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'bolillo'),
  0.5, 'unidad',
  'seco, en trozos',
  'main',
  16
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cda',
  'fina, o al gusto',
  'main',
  17
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caldo de pollo'),
  2, 'cubos',
  NULL,
  'main',
  18
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'manteca de cerdo'),
  30, 'g',
  'opcional',
  'main',
  19
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  200, 'g',
  NULL,
  'main',
  20
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chocolate de mesa'),
  50, 'g',
  'en trozos',
  'main',
  21
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pechuga de pollo'),
  500, 'g',
  'deshuesada y sin piel, en trozos medianos',
  'main',
  22
);

-- Recipe: Pescado a la veracruzana
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  300, 'g',
  '150 g en trozos y 150 g en rodajas',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  2, 'dientes',
  'pelados',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite de oliva'),
  50, 'g',
  'extra virgen',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate'),
  800, 'g',
  'en trozos',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'laurel'),
  1, 'hoja',
  'seca',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  5, 'g',
  'fina, al gusto',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  5, 'g',
  'molida, al gusto',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'azúcar'),
  1, 'cdta',
  NULL,
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'alcaparras'),
  40, 'g',
  NULL,
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceitunas verdes'),
  100, 'g',
  'deshuesadas',
  'main',
  10
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pescado blanco'),
  600, 'g',
  NULL,
  'main',
  11
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile güero'),
  30, 'g',
  'en escabeche',
  'main',
  12
);

-- Recipe: Cochinita pibil
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Cochinita pibil' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  20, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'orégano'),
  2, 'cdta',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'achiote'),
  15, 'g',
  'en pasta',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  0.5, 'cdta',
  'molida',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'comino'),
  0.5, 'cdta',
  'en polvo',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'vinagre blanco'),
  100, 'g',
  NULL,
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jugo de naranja'),
  300, 'g',
  'agria',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  100, 'g',
  'en trozos',
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  2, 'cdtas',
  'fina',
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pernil de cerdo'),
  1000, 'g',
  'en cubos (4 x 4 cm)',
  'main',
  10
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  20, 'g',
  NULL,
  'main',
  11
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'manteca de cerdo'),
  20, 'g',
  NULL,
  'main',
  12
);

-- Recipe: Adobo con carne
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Adobo con carne' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile guajillo'),
  20, 'g',
  'desvenados',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile pasilla'),
  20, 'g',
  'desvenados',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile ancho'),
  20, 'g',
  'desvenados',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'comino'),
  1, 'pizca',
  'en polvo',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'orégano'),
  1, 'pizca',
  NULL,
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  1, 'pizca',
  'molida',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'clavo de olor'),
  2, 'unidad',
  NULL,
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  1, 'diente',
  'pelado',
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  60, 'g',
  NULL,
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate'),
  500, 'g',
  'en trozos',
  'main',
  10
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caldo de res'),
  2, 'cubos',
  NULL,
  'main',
  11
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  20, 'g',
  'opcional',
  'main',
  12
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'vinagre de manzana'),
  10, 'g',
  NULL,
  'main',
  13
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  300, 'g',
  NULL,
  'main',
  14
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'lomo de cerdo'),
  1000, 'g',
  'en cubos (5 x 5 cm)',
  'main',
  15
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  2, 'cdtas',
  'o al gusto',
  'main',
  16
);

-- Recipe: Lasaña boloñesa
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Lasaña boloñesa' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso parmesano'),
  200, 'g',
  'en trozos (3 cm)',
  'general',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'zanahoria'),
  130, 'g',
  'en trozos',
  'Salsa Boloñesa',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimiento rojo'),
  0.5, 'unidad',
  'desvenado y en trozos',
  'Salsa Boloñesa',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'apio'),
  1, 'rama',
  'en trozos',
  'Salsa Boloñesa',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  1, 'diente',
  'pelado',
  'Salsa Boloñesa',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'champiñones'),
  180, 'g',
  'main',
  'Salsa Boloñesa',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate'),
  400, 'g',
  'en trozos',
  'Salsa Boloñesa',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  130, 'g',
  'en trozos',
  'Salsa Boloñesa',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  20, 'g',
  'vegetal',
  'Salsa Boloñesa',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'carne molida de res'),
  500, 'g',
  'main',
  'Salsa Boloñesa',
  10
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  0.5, 'cdta',
  'fina, o al gusto',
  'Salsa Boloñesa',
  11
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  1, 'pizca',
  'molida, o al gusto',
  'Salsa Boloñesa',
  12
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'orégano'),
  1, 'cdta',
  'seco',
  'Salsa Boloñesa',
  13
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'laurel'),
  1, 'hoja',
  'seca',
  'Salsa Boloñesa',
  14
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caldo de carne'),
  3, 'cubos',
  'main',
  'Salsa Boloñesa',
  15
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'leche'),
  1000, 'g',
  'main',
  'Salsa Bechamel',
  16
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
  80, 'g',
  'a temperatura ambiente',
  'Salsa Bechamel',
  17
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'harina'),
  100, 'g',
  'main',
  'Salsa Bechamel',
  18
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cdta',
  'fina, o al gusto',
  'Salsa Bechamel',
  19
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'nuez moscada'),
  2, 'pizcas',
  'en polvo, o al gusto',
  'Salsa Bechamel',
  20
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pasta para lasaña'),
  250, 'g',
  '12 hojas (aprox. 10 cm x 20 cm)',
  'Preparación de la lasaña',
  21
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
  10, 'g',
  'para engrasar el molde y la superficie',
  'Preparación de la lasaña',
  22
);

-- Recipe: Fideo seco en salsa de chiles
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Fideo seco en salsa de chiles' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso cotija'),
  50, 'g',
  'o 50 g de queso panela, en trozos',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  25, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  70, 'g',
  'en trozos',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  1, 'diente',
  'pelado',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate'),
  500, 'g',
  'en cuartos',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile morita'),
  1, 'unidad',
  'sin tallo ni semillas o al gusto (opcional)',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile cascabel'),
  1, 'unidad',
  'sin tallo ni semillas o al gusto (opcional)',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  0.5, 'cdta',
  'fina, o al gusto',
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  150, 'g',
  NULL,
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'fideos'),
  195, 'g',
  'secos, del No. 2 (fritos o tostados)',
  'main',
  10
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'crema ácida'),
  5, 'g',
  'la necesaria para servir',
  'main',
  11
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aguacate'),
  1, 'unidad',
  'el necesario para servir',
  'main',
  12
);

-- Recipe: Espagueti carbonara
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Espagueti carbonara' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso parmesano'),
  60, 'g',
  'en trozos',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso pecorino'),
  30, 'g',
  '(opcional)',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'echalot'),
  1, 'unidad',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'tocino ahumado'),
  150, 'g',
  'en cubos',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite de oliva'),
  20, 'g',
  'extra virgen',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  1200, 'g',
  NULL,
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  0.75, 'cdta',
  'fina (dividida: ½ + ¼)',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'spaghetti'),
  350, 'g',
  NULL,
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'huevo'),
  3, 'unidad',
  NULL,
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'yema de huevo'),
  1, 'unidad',
  NULL,
  'main',
  10
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  2, 'pizcas',
  'molida',
  'main',
  11
);

-- Recipe: Arroz negro cremoso con calamares
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Arroz negro cremoso con calamares' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  2, 'dientes',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  70, 'g',
  'en trozos',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite de oliva'),
  80, 'g',
  'virgen extra',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'calamar'),
  500, 'g',
  'limpios y cortados en trozos',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'tomate triturado'),
  70, 'g',
  'en conserva',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'arroz redondo'),
  250, 'g',
  NULL,
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caldo de pescado'),
  700, 'g',
  'muy caliente',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'tinta de calamar'),
  2, 'sobres',
  'disuelta en un poco de agua',
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cdta',
  NULL,
  'main',
  9
);

-- Recipe: Arroz blanco con verduras
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Arroz blanco con verduras' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'zanahoria'),
  100, 'g',
  'en trozos',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  50, 'g',
  'en trozos',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  3, 'dientes',
  'pelados',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  20, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  1200, 'g',
  NULL,
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cda',
  'fina, o al gusto',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'arroz'),
  250, 'g',
  'largo',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chícharos'),
  50, 'g',
  NULL,
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cilantro'),
  5, 'g',
  'fresco, 1 rama',
  'main',
  9
);

-- Recipe: Arroz a la mexicana
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Arroz a la mexicana' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'arroz'),
  250, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  50, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate'),
  180, 'g',
  'en trozos',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  1, 'diente',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caldo de tomate'),
  2, 'cubos',
  NULL,
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  20, 'g',
  NULL,
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  1000, 'g',
  NULL,
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mezcla de verduras'),
  50, 'g',
  'congeladas (zanahoria y chícharo)',
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cilantro'),
  1, 'ramita',
  'fresco',
  'main',
  9
);

-- Recipe: Sopa de cebolla
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Sopa de cebolla' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso gruyère'),
  80, 'g',
  'cortado en trozos',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  500, 'g',
  'cortadas en dos',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  30, 'g',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla'),
  20, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  0.5, 'cdta',
  'o al gusto',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  2, 'pellizcos',
  'molida, o al gusto',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'harina de trigo'),
  10, 'g',
  NULL,
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  900, 'g',
  NULL,
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caldo de pollo'),
  1, 'pastilla',
  NULL,
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'baguette'),
  12, 'rebanadas',
  'del día anterior',
  'main',
  10
);

-- Recipe: Sopa de tortilla
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Sopa de tortilla' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  250, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile pasilla'),
  5, 'unidad',
  'cortados en tiras',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'tortilla de maíz'),
  8, 'unidad',
  'cortadas en tiras',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  2, 'dientes',
  'pelados',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  150, 'g',
  'en trozos',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate'),
  750, 'g',
  'en cuartos',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  2, 'cdtas',
  'fina, o al gusto',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  600, 'g',
  NULL,
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chile verde'),
  1, 'unidad',
  'partido por la mitad',
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cilantro'),
  1, 'ramita',
  NULL,
  'main',
  10
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso panela'),
  150, 'g',
  'en cubos',
  'main',
  11
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'chicharrón'),
  70, 'g',
  'en trocitos',
  'main',
  12
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aguacate'),
  2, 'unidad',
  'la pulpa, en cubos',
  'main',
  13
);

-- Recipe: Sopa de fideo
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Sopa de fideo' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  70, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  1, 'diente',
  'pelado',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate guaje'),
  500, 'g',
  'en cuartos',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aceite'),
  25, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  1000, 'g',
  NULL,
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'fideos'),
  195, 'g',
  'secos, del No. 2, fritos o tostados',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caldo de pollo'),
  1, 'cubo',
  NULL,
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  0.5, 'cdtas',
  'fina, o al gusto',
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'crema ácida'),
  'main', 'g',
  'el necesario para servir',
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'aguacate'),
  'main', 'unidad',
  'en cubitos, el necesario para servir',
  'main',
  10
);

-- Recipe: Crema de verduras
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Crema de verduras' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'papa'),
  300, 'g',
  'en trozos',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'jitomate'),
  1, 'unidad',
  'en mitades',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  80, 'g',
  'en mitades',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  1, 'diente',
  'pelado',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mezcla de verduras'),
  400, 'g',
  'en trozos (p.ej. zanahoria, apio, poro)',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'perejil'),
  2, 'ramitas',
  'fresco',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  0.5, 'cdta',
  'fina, al gusto',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  0.5, 'cdta',
  'molida, al gusto',
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  600, 'g',
  'al gusto',
  'main',
  9
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
  20, 'g',
  NULL,
  'main',
  10
);

-- Recipe: Crema de champiñones
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Crema de champiñones' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'champiñones'),
  200, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  600, 'g',
  NULL,
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'leche'),
  200, 'g',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caldo de verdura'),
  1, 'cubo',
  'para 0,5L',
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'harina'),
  50, 'g',
  NULL,
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  0.5, 'cdta',
  'fina',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'crema'),
  50, 'g',
  NULL,
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'perejil'),
  4, 'ramitas',
  'fresco, sólo las hojas',
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso crema'),
  40, 'g',
  'opcional',
  'main',
  9
);

-- Recipe: Crema de espárragos y queso Brie
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Crema de espárragos y queso Brie' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla'),
  90, 'g',
  NULL,
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'espárragos'),
  300, 'g',
  'en trozos (sin las puntas)',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'harina de trigo'),
  25, 'g',
  NULL,
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caldo de pollo'),
  750, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'vino blanco'),
  125, 'g',
  NULL,
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'crema'),
  180, 'g',
  NULL,
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso brie'),
  115, 'g',
  'en trozos',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cdta',
  NULL,
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  0.5, 'cdta',
  'molida',
  'main',
  9
);

-- Recipe: Crema de calabacita
WITH recipe_id AS (
  SELECT id FROM recipes WHERE name = 'Crema de calabacita' LIMIT 1
)
INSERT INTO recipe_ingredients 
(recipe_id, ingredient_id, quantity, unit, notes, component, display_order) 
VALUES
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'cebolla'),
  50, 'g',
  'en trozos',
  'main',
  1
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'ajo'),
  1, 'diente',
  'opcional',
  'main',
  2
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'calabacita'),
  700, 'g',
  'en trozos',
  'main',
  3
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'agua'),
  500, 'g',
  NULL,
  'main',
  4
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'caldo de verdura'),
  1, 'cubo',
  'para 0,5L',
  'main',
  5
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'sal'),
  1, 'cdita',
  'y un poco más al gusto',
  'main',
  6
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
  1, 'pizca',
  'molida, y un poco más al gusto',
  'main',
  7
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
  10, 'g',
  NULL,
  'main',
  8
),
(
  (SELECT id FROM recipe_id),
  (SELECT id FROM ingredients WHERE name = 'queso crema'),
  40, 'g',
  NULL,
  'main',
  9
);

COMMIT;