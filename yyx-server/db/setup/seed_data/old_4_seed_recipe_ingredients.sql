BEGIN;

-- Create index for faster recipe ingredient lookups
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_id_idx ON recipe_ingredients (recipe_id);
CREATE INDEX IF NOT EXISTS recipe_ingredients_ingredient_id_idx ON recipe_ingredients (ingredient_id);

-- Recipe: "Panqué de nuez glaseado"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Bizcocho component
  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM ingredients WHERE name = 'nuez de castilla'),
   80, 'g', NULL, 'Bizcocho', 1, false),
   
  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
   170, 'g', 'en trozos a temperatura ambiente', 'Bizcocho', 2, false),
   
  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM ingredients WHERE name = 'azúcar moscabada'),
   230, 'g', NULL, 'Bizcocho', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM ingredients WHERE name = 'huevo'),
   2, 'unidad', NULL, 'Bizcocho', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM ingredients WHERE name = 'leche entera'),
   100, 'g', NULL, 'Bizcocho', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM ingredients WHERE name = 'harina de trigo'),
   190, 'g', NULL, 'Bizcocho', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM ingredients WHERE name = 'polvo para hornear'),
   1, 'cdta', NULL, 'Bizcocho', 7, false),

  -- Glaseado component
  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM ingredients WHERE name = 'nuez de castilla'),
   50, 'g', NULL, 'Glaseado', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM ingredients WHERE name = 'azúcar moscabada'),
   100, 'g', NULL, 'Glaseado', 9, false),

  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
   20, 'g', NULL, 'Glaseado', 10, false),

  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM ingredients WHERE name = 'jarabe de maple'),
   40, 'g', NULL, 'Glaseado', 11, false);

-- Recipe: "Nieve rápida de fruta"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Nieve rápida de fruta'),
   (SELECT id FROM ingredients WHERE name = 'azúcar'),
   180, 'g', NULL, 'general', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Nieve rápida de fruta'),
   (SELECT id FROM ingredients WHERE name = 'limón verde'),
   10, 'g', 'recién exprimido', 'general', 2, false);

-- Continuing with "Crema de calabacita"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   50, 'g', 'en trozos', 'general', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   1, 'diente', NULL, 'general', 2, true),

  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM ingredients WHERE name = 'calabacita italiana'),
   700, 'g', 'en trozos', 'general', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM ingredients WHERE name = 'agua'),
   500, 'g', NULL, 'general', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM ingredients WHERE name = 'caldo de verdura en cubo'),
   1, 'unidad', 'para 0.5L', 'general', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM ingredients WHERE name = 'sal fina'),
   1, 'cdta', 'y un poco más al gusto', 'general', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM ingredients WHERE name = 'pimienta molida'),
   1, 'pizca', 'y un poco más al gusto', 'general', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM ingredients WHERE name = 'mantequilla sin sal'),
   10, 'g', NULL, 'general', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM ingredients WHERE name = 'queso crema'),
   40, 'g', NULL, 'general', 9, false);

-- Recipe: "Mole con pollo"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'chile mulato seco'),
   4, 'unidad', 'desvenados', 'Salsa', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'chile ancho seco'),
   2, 'unidad', 'desvenados', 'Salsa', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'chile chipotle seco'),
   2, 'unidad', 'desvenados', 'Salsa', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'romero fresco'),
   1, 'rama', 'sólo las hojas', 'Salsa', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'tomillo seco'),
   1, 'rama', 'sólo las hojas', 'Salsa', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'pimienta gorda'),
   2, 'unidad', NULL, 'Salsa', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'ajonjolí'),
   20, 'g', NULL, 'Salsa', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'canela en rama'),
   0.5, 'cdta', NULL, 'Salsa', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'almendra'),
   20, 'g', NULL, 'Salsa', 9, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'pepita de calabaza'),
   20, 'g', NULL, 'Salsa', 10, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'cacahuate sin sal'),
   20, 'g', NULL, 'Salsa', 11, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   50, 'g', NULL, 'Salsa', 12, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   2, 'dientes', 'pelados', 'Salsa', 13, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'jitomate'),
   200, 'g', 'en trozos', 'Salsa', 14, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'pasita'),
   20, 'g', NULL, 'Salsa', 15, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'bolillo'),
   0.5, 'unidad', 'en trozos', 'Salsa', 16, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'sal fina'),
   1, 'cda', 'o al gusto', 'Salsa', 17, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'caldo de pollo en cubo'),
   2, 'unidad', NULL, 'Salsa', 18, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'manteca de cerdo'),
   30, 'g', NULL, 'Salsa', 19, true),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'agua'),
   200, 'g', NULL, 'Salsa', 20, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'chocolate de mesa'),
   50, 'g', 'en trozos', 'Salsa', 21, false),

  ((SELECT id FROM recipes WHERE name = 'Mole con pollo'),
   (SELECT id FROM ingredients WHERE name = 'pechuga de pollo sin piel'),
   500, 'g', 'en trozos medianos', 'Salsa', 22, false);

-- Recipe: "Pescado a la veracruzana"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'filete de pescado'),
   800, 'g', NULL, 'general', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'limón'),
   2, 'unidad', 'el jugo', 'general', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'sal fina'),
   1, 'cdta', 'al gusto', 'general', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'pimienta molida'),
   1, 'pizca', 'al gusto', 'general', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'aceite de oliva'),
   30, 'g', NULL, 'general', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   150, 'g', 'en rodajas', 'general', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   2, 'dientes', 'picados', 'general', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'jitomate'),
   400, 'g', 'en rodajas', 'general', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'chile jalapeño'),
   2, 'unidad', 'en rodajas', 'general', 9, true),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'laurel'),
   2, 'hojas', NULL, 'general', 10, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'orégano seco'),
   1, 'cdta', NULL, 'general', 11, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'alcaparras'),
   30, 'g', NULL, 'general', 12, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'aceitunas verdes'),
   100, 'g', 'deshuesadas', 'general', 13, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM ingredients WHERE name = 'vino blanco'),
   60, 'ml', NULL, 'general', 14, false);

   -- Recipe: "Sopa de tortilla"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'tortilla de maíz'),
   6, 'unidad', 'cortadas en tiras', 'general', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'aceite vegetal'),
   30, 'ml', 'para freír', 'general', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'jitomate'),
   500, 'g', 'en cuartos', 'general', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   100, 'g', 'en trozos', 'general', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   2, 'dientes', NULL, 'general', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'chile chipotle en adobo'),
   1, 'unidad', NULL, 'general', 6, true),

  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'caldo de pollo'),
   1000, 'ml', NULL, 'general', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'epazote'),
   2, 'ramas', NULL, 'general', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'sal fina'),
   1, 'cdta', 'al gusto', 'general', 9, false),

  -- Guarnición component
  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'aguacate'),
   1, 'unidad', 'en cubos', 'Guarnición', 10, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'queso panela'),
   200, 'g', 'desmoronado', 'Guarnición', 11, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'crema'),
   120, 'ml', NULL, 'Guarnición', 12, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM ingredients WHERE name = 'chile pasilla'),
   2, 'unidad', 'frito y desmenuzado', 'Guarnición', 13, false);

-- Recipe: "Flan napolitano"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Caramelo component
  ((SELECT id FROM recipes WHERE name = 'Flan napolitano'),
   (SELECT id FROM ingredients WHERE name = 'azúcar'),
   200, 'g', NULL, 'Caramelo', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Flan napolitano'),
   (SELECT id FROM ingredients WHERE name = 'agua'),
   60, 'ml', NULL, 'Caramelo', 2, false),

  -- Flan component
  ((SELECT id FROM recipes WHERE name = 'Flan napolitano'),
   (SELECT id FROM ingredients WHERE name = 'leche condensada'),
   387, 'g', '1 lata', 'Flan', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Flan napolitano'),
   (SELECT id FROM ingredients WHERE name = 'leche evaporada'),
   360, 'ml', '1 lata', 'Flan', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Flan napolitano'),
   (SELECT id FROM ingredients WHERE name = 'queso crema'),
   190, 'g', 'temperatura ambiente', 'Flan', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Flan napolitano'),
   (SELECT id FROM ingredients WHERE name = 'huevo'),
   5, 'unidad', 'temperatura ambiente', 'Flan', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Flan napolitano'),
   (SELECT id FROM ingredients WHERE name = 'vainilla'),
   1, 'cdta', NULL, 'Flan', 7, false);

-- Recipe: "Pozole rojo"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Base component
  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'maíz pozolero'),
   500, 'g', 'precocido', 'Base', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'carne de cerdo'),
   1000, 'g', 'en trozos grandes', 'Base', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   1, 'unidad', 'grande, partida en mitad', 'Base', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   4, 'dientes', NULL, 'Base', 4, false),

  -- Salsa component
  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'chile ancho'),
   4, 'unidad', 'desvenados', 'Salsa', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'chile guajillo'),
   4, 'unidad', 'desvenados', 'Salsa', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'orégano mexicano'),
   1, 'cdta', NULL, 'Salsa', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'sal fina'),
   2, 'cdta', 'al gusto', 'Salsa', 8, false),

  -- Guarnición component
  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'lechuga'),
   200, 'g', 'finamente rebanada', 'Guarnición', 9, false),

  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'rábano'),
   100, 'g', 'en rodajas', 'Guarnición', 10, false),

  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   1, 'unidad', 'finamente picada', 'Guarnición', 11, false),

  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'limón'),
   4, 'unidad', 'partidos en mitades', 'Guarnición', 12, false),

  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'orégano mexicano'),
   2, 'cda', 'seco', 'Guarnición', 13, false),

  ((SELECT id FROM recipes WHERE name = 'Pozole rojo'),
   (SELECT id FROM ingredients WHERE name = 'chile de árbol'),
   4, 'unidad', 'molido', 'Guarnición', 14, true);

-- Recipe: "Chiles en nogada"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Relleno component
  ((SELECT id FROM recipes WHERE name = 'Chiles en nogada'),
   (SELECT id FROM ingredients WHERE name = 'chile poblano'),
   8, 'unidad', 'asados y pelados', 'Relleno', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles en nogada'),
   (SELECT id FROM ingredients WHERE name = 'carne molida de cerdo'),
   500, 'g', NULL, 'Relleno', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles en nogada'),
   (SELECT id FROM ingredients WHERE name = 'manzana'),
   2, 'unidad', 'picada finamente', 'Relleno', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles en nogada'),
   (SELECT id FROM ingredients WHERE name = 'durazno'),
   2, 'unidad', 'picado finamente', 'Relleno', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles en nogada'),
   (SELECT id FROM ingredients WHERE name = 'plátano macho'),
   1, 'unidad', 'picado finamente', 'Relleno', 5, false),

  -- Nogada component
  ((SELECT id FROM recipes WHERE name = 'Chiles en nogada'),
   (SELECT id FROM ingredients WHERE name = 'nuez de castilla'),
   250, 'g', 'peladas', 'Nogada', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles en nogada'),
   (SELECT id FROM ingredients WHERE name = 'queso crema'),
   200, 'g', NULL, 'Nogada', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles en nogada'),
   (SELECT id FROM ingredients WHERE name = 'leche'),
   120, 'ml', NULL, 'Nogada', 8, false),

  -- Decoración component
  ((SELECT id FROM recipes WHERE name = 'Chiles en nogada'),
   (SELECT id FROM ingredients WHERE name = 'granada'),
   1, 'unidad', 'desgranada', 'Decoración', 9, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles en nogada'),
   (SELECT id FROM ingredients WHERE name = 'perejil'),
   1, 'manojo', 'hojas', 'Decoración', 10, false);

-- Recipe: "Tamales verdes"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Masa component
  ((SELECT id FROM recipes WHERE name = 'Tamales verdes'),
   (SELECT id FROM ingredients WHERE name = 'masa para tamales'),
   1000, 'g', NULL, 'Masa', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Tamales verdes'),
   (SELECT id FROM ingredients WHERE name = 'manteca de cerdo'),
   300, 'g', NULL, 'Masa', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Tamales verdes'),
   (SELECT id FROM ingredients WHERE name = 'caldo de pollo'),
   250, 'ml', 'tibio', 'Masa', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Tamales verdes'),
   (SELECT id FROM ingredients WHERE name = 'polvo para hornear'),
   1, 'cdta', NULL, 'Masa', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Tamales verdes'),
   (SELECT id FROM ingredients WHERE name = 'sal fina'),
   1, 'cdta', NULL, 'Masa', 5, false),

  -- Salsa verde component
  ((SELECT id FROM recipes WHERE name = 'Tamales verdes'),
   (SELECT id FROM ingredients WHERE name = 'tomatillo'),
   500, 'g', NULL, 'Salsa verde', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Tamales verdes'),
   (SELECT id FROM ingredients WHERE name = 'chile serrano'),
   4, 'unidad', NULL, 'Salsa verde', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Tamales verdes'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   1, 'unidad', 'mediana', 'Salsa verde', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Tamales verdes'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   2, 'dientes', NULL, 'Salsa verde', 9, false),

  -- Relleno component
  ((SELECT id FROM recipes WHERE name = 'Tamales verdes'),
   (SELECT id FROM ingredients WHERE name = 'pollo'),
   500, 'g', 'cocido y deshebrado', 'Relleno', 10, false),

  -- Envoltura component
  ((SELECT id FROM recipes WHERE name = 'Tamales verdes'),
   (SELECT id FROM ingredients WHERE name = 'hoja de maíz'),
   20, 'unidad', 'remojadas', 'Envoltura', 11, false);

   -- Recipe: "Enchiladas verdes"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Enchiladas verdes'),
   (SELECT id FROM ingredients WHERE name = 'tortilla de maíz'),
   12, 'unidad', NULL, 'general', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Enchiladas verdes'),
   (SELECT id FROM ingredients WHERE name = 'tomatillo'),
   500, 'g', NULL, 'Salsa', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Enchiladas verdes'),
   (SELECT id FROM ingredients WHERE name = 'chile serrano'),
   2, 'unidad', NULL, 'Salsa', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Enchiladas verdes'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   1, 'unidad', 'mediana', 'Salsa', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Enchiladas verdes'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   2, 'dientes', NULL, 'Salsa', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Enchiladas verdes'),
   (SELECT id FROM ingredients WHERE name = 'cilantro'),
   1, 'manojo', NULL, 'Salsa', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Enchiladas verdes'),
   (SELECT id FROM ingredients WHERE name = 'pollo'),
   500, 'g', 'cocido y deshebrado', 'Relleno', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Enchiladas verdes'),
   (SELECT id FROM ingredients WHERE name = 'crema'),
   200, 'ml', NULL, 'Decoración', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Enchiladas verdes'),
   (SELECT id FROM ingredients WHERE name = 'queso fresco'),
   200, 'g', 'desmoronado', 'Decoración', 9, false),

  ((SELECT id FROM recipes WHERE name = 'Enchiladas verdes'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   1, 'unidad', 'fileteada', 'Decoración', 10, false);

-- Recipe: "Arroz con leche"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Arroz con leche'),
   (SELECT id FROM ingredients WHERE name = 'arroz'),
   200, 'g', NULL, 'general', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Arroz con leche'),
   (SELECT id FROM ingredients WHERE name = 'leche entera'),
   1000, 'ml', NULL, 'general', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Arroz con leche'),
   (SELECT id FROM ingredients WHERE name = 'canela en rama'),
   2, 'rama', NULL, 'general', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Arroz con leche'),
   (SELECT id FROM ingredients WHERE name = 'azúcar'),
   200, 'g', NULL, 'general', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Arroz con leche'),
   (SELECT id FROM ingredients WHERE name = 'vainilla'),
   1, 'cdta', NULL, 'general', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Arroz con leche'),
   (SELECT id FROM ingredients WHERE name = 'pasitas'),
   50, 'g', NULL, 'general', 6, true),

  ((SELECT id FROM recipes WHERE name = 'Arroz con leche'),
   (SELECT id FROM ingredients WHERE name = 'canela molida'),
   1, 'cdta', 'para decorar', 'Decoración', 7, true);

-- Recipe: "Cochinita pibil"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'pierna de cerdo'),
   1500, 'g', 'en trozos', 'Carne', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'achiote'),
   100, 'g', 'en pasta', 'Marinada', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'naranja agria'),
   4, 'unidad', 'el jugo', 'Marinada', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   6, 'dientes', NULL, 'Marinada', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'orégano'),
   1, 'cdta', NULL, 'Marinada', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'comino'),
   1, 'cdta', 'molido', 'Marinada', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
   1, 'cdta', 'molida', 'Marinada', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'clavo'),
   4, 'unidad', NULL, 'Marinada', 8, false),

  -- Salsa component
  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'cebolla morada'),
   2, 'unidad', 'fileteada', 'Salsa', 9, false),

  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'chile habanero'),
   2, 'unidad', NULL, 'Salsa', 10, false),

  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'naranja agria'),
   2, 'unidad', 'el jugo', 'Salsa', 11, false),

  -- Acompañamiento
  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM ingredients WHERE name = 'tortilla de maíz'),
   12, 'unidad', NULL, 'Acompañamiento', 12, false);

-- Recipe: "Camarones al mojo de ajo"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Camarones al mojo de ajo'),
   (SELECT id FROM ingredients WHERE name = 'camarón'),
   500, 'g', 'pelados y desvenados', 'general', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Camarones al mojo de ajo'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   8, 'dientes', 'finamente picados', 'general', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Camarones al mojo de ajo'),
   (SELECT id FROM ingredients WHERE name = 'mantequilla'),
   100, 'g', NULL, 'general', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Camarones al mojo de ajo'),
   (SELECT id FROM ingredients WHERE name = 'aceite de oliva'),
   30, 'ml', NULL, 'general', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Camarones al mojo de ajo'),
   (SELECT id FROM ingredients WHERE name = 'perejil'),
   1, 'manojo', 'picado', 'general', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Camarones al mojo de ajo'),
   (SELECT id FROM ingredients WHERE name = 'limón'),
   2, 'unidad', NULL, 'general', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Camarones al mojo de ajo'),
   (SELECT id FROM ingredients WHERE name = 'sal fina'),
   1, 'cdta', 'al gusto', 'general', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Camarones al mojo de ajo'),
   (SELECT id FROM ingredients WHERE name = 'pimienta negra'),
   1, 'cdta', 'al gusto', 'general', 8, false);

-- Recipe: "Guacamole tradicional"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Guacamole tradicional'),
   (SELECT id FROM ingredients WHERE name = 'aguacate'),
   3, 'unidad', 'maduros', 'general', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Guacamole tradicional'),
   (SELECT id FROM ingredients WHERE name = 'jitomate'),
   1, 'unidad', 'picado', 'general', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Guacamole tradicional'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   0.25, 'unidad', 'finamente picada', 'general', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Guacamole tradicional'),
   (SELECT id FROM ingredients WHERE name = 'cilantro'),
   2, 'cda', 'picado', 'general', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Guacamole tradicional'),
   (SELECT id FROM ingredients WHERE name = 'chile serrano'),
   1, 'unidad', 'finamente picado', 'general', 5, true),

  ((SELECT id FROM recipes WHERE name = 'Guacamole tradicional'),
   (SELECT id FROM ingredients WHERE name = 'limón verde'),
   1, 'unidad', 'el jugo', 'general', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Guacamole tradicional'),
   (SELECT id FROM ingredients WHERE name = 'sal fina'),
   1, 'cdta', 'al gusto', 'general', 7, false);

   -- Recipe: "Chilaquiles rojos"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Salsa component
  ((SELECT id FROM recipes WHERE name = 'Chilaquiles rojos'),
   (SELECT id FROM ingredients WHERE name = 'chile guajillo'),
   4, 'unidad', 'desvenados', 'Salsa', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Chilaquiles rojos'),
   (SELECT id FROM ingredients WHERE name = 'jitomate'),
   4, 'unidad', NULL, 'Salsa', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Chilaquiles rojos'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   2, 'dientes', NULL, 'Salsa', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Chilaquiles rojos'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   0.25, 'unidad', NULL, 'Salsa', 4, false),

  -- Base component
  ((SELECT id FROM recipes WHERE name = 'Chilaquiles rojos'),
   (SELECT id FROM ingredients WHERE name = 'tortilla de maíz'),
   12, 'unidad', 'cortadas en triángulos', 'Base', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Chilaquiles rojos'),
   (SELECT id FROM ingredients WHERE name = 'aceite vegetal'),
   500, 'ml', 'para freír', 'Base', 6, false),

  -- Guarnición component
  ((SELECT id FROM recipes WHERE name = 'Chilaquiles rojos'),
   (SELECT id FROM ingredients WHERE name = 'crema'),
   200, 'ml', NULL, 'Guarnición', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Chilaquiles rojos'),
   (SELECT id FROM ingredients WHERE name = 'queso fresco'),
   200, 'g', 'desmoronado', 'Guarnición', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Chilaquiles rojos'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   0.5, 'unidad', 'fileteada', 'Guarnición', 9, false),

  ((SELECT id FROM recipes WHERE name = 'Chilaquiles rojos'),
   (SELECT id FROM ingredients WHERE name = 'aguacate'),
   1, 'unidad', 'en rebanadas', 'Guarnición', 10, true);

-- Recipe: "Tinga de pollo"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'pechuga de pollo'),
   500, 'g', NULL, 'general', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'jitomate'),
   4, 'unidad', NULL, 'general', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   2, 'unidad', 'fileteada', 'general', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   2, 'dientes', NULL, 'general', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'chile chipotle en adobo'),
   3, 'unidad', NULL, 'general', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'laurel'),
   1, 'hoja', NULL, 'general', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'aceite vegetal'),
   30, 'ml', NULL, 'general', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'sal fina'),
   1, 'cdta', 'al gusto', 'general', 8, false),

  -- Para servir
  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'tostada'),
   12, 'unidad', NULL, 'Para servir', 9, false),

  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'crema'),
   200, 'ml', NULL, 'Para servir', 10, false),

  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'queso fresco'),
   200, 'g', 'desmoronado', 'Para servir', 11, false),

  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM ingredients WHERE name = 'aguacate'),
   2, 'unidad', 'en rebanadas', 'Para servir', 12, false);


-- Recipe: "Sopa de fideo"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Sopa de fideo'),
   (SELECT id FROM ingredients WHERE name = 'fideo'),
   250, 'g', NULL, 'general', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de fideo'),
   (SELECT id FROM ingredients WHERE name = 'jitomate'),
   3, 'unidad', NULL, 'general', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de fideo'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   0.25, 'unidad', NULL, 'general', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de fideo'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   1, 'diente', NULL, 'general', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de fideo'),
   (SELECT id FROM ingredients WHERE name = 'aceite vegetal'),
   30, 'ml', NULL, 'general', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de fideo'),
   (SELECT id FROM ingredients WHERE name = 'agua'),
   1000, 'ml', NULL, 'general', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Sopa de fideo'),
   (SELECT id FROM ingredients WHERE name = 'caldo de pollo en cubo'),
   1, 'unidad', NULL, 'general', 7, false);

-- Recipe: "Chiles rellenos"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Chiles component
  ((SELECT id FROM recipes WHERE name = 'Chiles rellenos'),
   (SELECT id FROM ingredients WHERE name = 'chile poblano'),
   6, 'unidad', 'asados y pelados', 'Chiles', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles rellenos'),
   (SELECT id FROM ingredients WHERE name = 'queso Oaxaca'),
   400, 'g', 'deshebrado', 'Chiles', 2, false),

  -- Caldillo component
  ((SELECT id FROM recipes WHERE name = 'Chiles rellenos'),
   (SELECT id FROM ingredients WHERE name = 'jitomate'),
   4, 'unidad', NULL, 'Caldillo', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles rellenos'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   0.25, 'unidad', NULL, 'Caldillo', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles rellenos'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   1, 'diente', NULL, 'Caldillo', 5, false),

  -- Capeo component
  ((SELECT id FROM recipes WHERE name = 'Chiles rellenos'),
   (SELECT id FROM ingredients WHERE name = 'huevo'),
   4, 'unidad', 'separados', 'Capeo', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles rellenos'),
   (SELECT id FROM ingredients WHERE name = 'harina de trigo'),
   100, 'g', NULL, 'Capeo', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Chiles rellenos'),
   (SELECT id FROM ingredients WHERE name = 'aceite vegetal'),
   500, 'ml', 'para freír', 'Capeo', 8, false);

-- Recipe: "Tacos al pastor"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Marinada component
  ((SELECT id FROM recipes WHERE name = 'Tacos al pastor'),
   (SELECT id FROM ingredients WHERE name = 'chile guajillo'),
   4, 'unidad', 'desvenados', 'Marinada', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Tacos al pastor'),
   (SELECT id FROM ingredients WHERE name = 'chile ancho'),
   2, 'unidad', 'desvenados', 'Marinada', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Tacos al pastor'),
   (SELECT id FROM ingredients WHERE name = 'achiote'),
   50, 'g', 'en pasta', 'Marinada', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Tacos al pastor'),
   (SELECT id FROM ingredients WHERE name = 'piña'),
   0.5, 'unidad', 'en trozos', 'Marinada', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Tacos al pastor'),
   (SELECT id FROM ingredients WHERE name = 'vinagre'),
   60, 'ml', NULL, 'Marinada', 5, false),

  -- Carne component
  ((SELECT id FROM recipes WHERE name = 'Tacos al pastor'),
   (SELECT id FROM ingredients WHERE name = 'carne de cerdo'),
   1000, 'g', 'en láminas delgadas', 'Carne', 6, false),

  -- Para servir component
  ((SELECT id FROM recipes WHERE name = 'Tacos al pastor'),
   (SELECT id FROM ingredients WHERE name = 'tortilla de maíz'),
   24, 'unidad', NULL, 'Para servir', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Tacos al pastor'),
   (SELECT id FROM ingredients WHERE name = 'piña'),
   0.5, 'unidad', 'en cubos pequeños', 'Para servir', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Tacos al pastor'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   1, 'unidad', 'picada', 'Para servir', 9, false),

  ((SELECT id FROM recipes WHERE name = 'Tacos al pastor'),
   (SELECT id FROM ingredients WHERE name = 'cilantro'),
   1, 'manojo', 'picado', 'Para servir', 10, false),

  ((SELECT id FROM recipes WHERE name = 'Tacos al pastor'),
   (SELECT id FROM ingredients WHERE name = 'limón verde'),
   4, 'unidad', NULL, 'Para servir', 11, false);

-- Recipe: "Caldo tlalpeño"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Caldo base
  ((SELECT id FROM recipes WHERE name = 'Caldo tlalpeño'),
   (SELECT id FROM ingredients WHERE name = 'pechuga de pollo'),
   1000, 'g', 'con hueso', 'Caldo base', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Caldo tlalpeño'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   1, 'unidad', NULL, 'Caldo base', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Caldo tlalpeño'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   3, 'dientes', NULL, 'Caldo base', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Caldo tlalpeño'),
   (SELECT id FROM ingredients WHERE name = 'zanahoria'),
   2, 'unidad', 'en rodajas', 'Caldo base', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Caldo tlalpeño'),
   (SELECT id FROM ingredients WHERE name = 'papa'),
   2, 'unidad', 'en cubos', 'Caldo base', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Caldo tlalpeño'),
   (SELECT id FROM ingredients WHERE name = 'garbanzo'),
   200, 'g', 'cocido', 'Caldo base', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Caldo tlalpeño'),
   (SELECT id FROM ingredients WHERE name = 'chile chipotle'),
   2, 'unidad', NULL, 'Caldo base', 7, false),

  -- Guarnición
  ((SELECT id FROM recipes WHERE name = 'Caldo tlalpeño'),
   (SELECT id FROM ingredients WHERE name = 'aguacate'),
   2, 'unidad', 'en cubos', 'Guarnición', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Caldo tlalpeño'),
   (SELECT id FROM ingredients WHERE name = 'limón'),
   4, 'unidad', NULL, 'Guarnición', 9, false),

  ((SELECT id FROM recipes WHERE name = 'Caldo tlalpeño'),
   (SELECT id FROM ingredients WHERE name = 'queso panela'),
   200, 'g', 'en cubos', 'Guarnición', 10, false);

-- Recipe: "Huevos rancheros"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Base
  ((SELECT id FROM recipes WHERE name = 'Huevos rancheros'),
   (SELECT id FROM ingredients WHERE name = 'huevo'),
   4, 'unidad', NULL, 'Base', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Huevos rancheros'),
   (SELECT id FROM ingredients WHERE name = 'tortilla de maíz'),
   4, 'unidad', NULL, 'Base', 2, false),

  -- Salsa
  ((SELECT id FROM recipes WHERE name = 'Huevos rancheros'),
   (SELECT id FROM ingredients WHERE name = 'jitomate'),
   4, 'unidad', NULL, 'Salsa', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Huevos rancheros'),
   (SELECT id FROM ingredients WHERE name = 'chile serrano'),
   2, 'unidad', NULL, 'Salsa', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Huevos rancheros'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   0.25, 'unidad', NULL, 'Salsa', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Huevos rancheros'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   1, 'diente', NULL, 'Salsa', 6, false),

  -- Guarnición
  ((SELECT id FROM recipes WHERE name = 'Huevos rancheros'),
   (SELECT id FROM ingredients WHERE name = 'frijoles refritos'),
   200, 'g', NULL, 'Guarnición', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Huevos rancheros'),
   (SELECT id FROM ingredients WHERE name = 'queso fresco'),
   100, 'g', 'desmoronado', 'Guarnición', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Huevos rancheros'),
   (SELECT id FROM ingredients WHERE name = 'aguacate'),
   1, 'unidad', 'en rebanadas', 'Guarnición', 9, false);

-- Recipe: "Mole verde"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Salsa
  ((SELECT id FROM recipes WHERE name = 'Mole verde'),
   (SELECT id FROM ingredients WHERE name = 'pepita verde'),
   200, 'g', 'pelada', 'Salsa', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Mole verde'),
   (SELECT id FROM ingredients WHERE name = 'tomatillo'),
   500, 'g', NULL, 'Salsa', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Mole verde'),
   (SELECT id FROM ingredients WHERE name = 'chile serrano'),
   3, 'unidad', NULL, 'Salsa', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Mole verde'),
   (SELECT id FROM ingredients WHERE name = 'lechuga'),
   2, 'hojas', NULL, 'Salsa', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Mole verde'),
   (SELECT id FROM ingredients WHERE name = 'epazote'),
   3, 'rama', NULL, 'Salsa', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Mole verde'),
   (SELECT id FROM ingredients WHERE name = 'cilantro'),
   1, 'manojo', NULL, 'Salsa', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Mole verde'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   0.5, 'unidad', NULL, 'Salsa', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Mole verde'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   2, 'dientes', NULL, 'Salsa', 8, false),

  -- Proteína
  ((SELECT id FROM recipes WHERE name = 'Mole verde'),
   (SELECT id FROM ingredients WHERE name = 'pechuga de pollo'),
   800, 'g', 'en piezas', 'Proteína', 9, false);


-- Recipe: "Pescado zarandeado"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Marinada
  ((SELECT id FROM recipes WHERE name = 'Pescado zarandeado'),
   (SELECT id FROM ingredients WHERE name = 'pescado huachinango'),
   1500, 'g', 'entero, limpio', 'Pescado', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado zarandeado'),
   (SELECT id FROM ingredients WHERE name = 'chile ancho'),
   3, 'unidad', 'desvenados', 'Marinada', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado zarandeado'),
   (SELECT id FROM ingredients WHERE name = 'achiote'),
   30, 'g', 'en pasta', 'Marinada', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado zarandeado'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   4, 'dientes', NULL, 'Marinada', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado zarandeado'),
   (SELECT id FROM ingredients WHERE name = 'naranja agria'),
   2, 'unidad', 'el jugo', 'Marinada', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado zarandeado'),
   (SELECT id FROM ingredients WHERE name = 'aceite vegetal'),
   60, 'ml', NULL, 'Marinada', 6, false),

  -- Acompañamiento
  ((SELECT id FROM recipes WHERE name = 'Pescado zarandeado'),
   (SELECT id FROM ingredients WHERE name = 'cebolla morada'),
   1, 'unidad', 'en aros', 'Acompañamiento', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado zarandeado'),
   (SELECT id FROM ingredients WHERE name = 'limón'),
   4, 'unidad', NULL, 'Acompañamiento', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Pescado zarandeado'),
   (SELECT id FROM ingredients WHERE name = 'tortilla de maíz'),
   12, 'unidad', NULL, 'Acompañamiento', 9, false);

-- Recipe: "Barbacoa de res"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  -- Carne
  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'carne de res'),
   2000, 'g', 'para barbacoa', 'Carne', 1, false),

  -- Adobo
  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'chile guajillo'),
   4, 'unidad', 'desvenados', 'Adobo', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'chile ancho'),
   2, 'unidad', 'desvenados', 'Adobo', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'ajo'),
   6, 'dientes', NULL, 'Adobo', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   0.5, 'unidad', NULL, 'Adobo', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'comino'),
   1, 'cdta', 'molido', 'Adobo', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'orégano'),
   1, 'cdta', NULL, 'Adobo', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'hoja de aguacate'),
   4, 'unidad', 'secas', 'Adobo', 8, false),

  -- Acompañamiento
  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'tortilla de maíz'),
   24, 'unidad', NULL, 'Acompañamiento', 9, false),

  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'limón'),
   4, 'unidad', NULL, 'Acompañamiento', 10, false),

  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'cebolla'),
   1, 'unidad', 'picada', 'Acompañamiento', 11, false),

  ((SELECT id FROM recipes WHERE name = 'Barbacoa de res'),
   (SELECT id FROM ingredients WHERE name = 'cilantro'),
   1, 'manojo', 'picado', 'Acompañamiento', 12, false);

-- Recipe: "Ceviche de pescado"
INSERT INTO recipe_ingredients 
  (recipe_id, ingredient_id, quantity, unit, notes, component, display_order, optional) 
VALUES
  ((SELECT id FROM recipes WHERE name = 'Ceviche de pescado'),
   (SELECT id FROM ingredients WHERE name = 'pescado blanco'),
   500, 'g', 'en cubos', 'general', 1, false),

  ((SELECT id FROM recipes WHERE name = 'Ceviche de pescado'),
   (SELECT id FROM ingredients WHERE name = 'limón'),
   10, 'unidad', 'el jugo', 'general', 2, false),

  ((SELECT id FROM recipes WHERE name = 'Ceviche de pescado'),
   (SELECT id FROM ingredients WHERE name = 'cebolla morada'),
   1, 'unidad', 'finamente picada', 'general', 3, false),

  ((SELECT id FROM recipes WHERE name = 'Ceviche de pescado'),
   (SELECT id FROM ingredients WHERE name = 'jitomate'),
   2, 'unidad', 'sin semillas, en cubos', 'general', 4, false),

  ((SELECT id FROM recipes WHERE name = 'Ceviche de pescado'),
   (SELECT id FROM ingredients WHERE name = 'cilantro'),
   1, 'manojo', 'picado', 'general', 5, false),

  ((SELECT id FROM recipes WHERE name = 'Ceviche de pescado'),
   (SELECT id FROM ingredients WHERE name = 'chile serrano'),
   1, 'unidad', 'finamente picado', 'general', 6, false),

  ((SELECT id FROM recipes WHERE name = 'Ceviche de pescado'),
   (SELECT id FROM ingredients WHERE name = 'aguacate'),
   1, 'unidad', 'en cubos', 'general', 7, false),

  ((SELECT id FROM recipes WHERE name = 'Ceviche de pescado'),
   (SELECT id FROM ingredients WHERE name = 'sal fina'),
   1, 'cdta', 'al gusto', 'general', 8, false),

  ((SELECT id FROM recipes WHERE name = 'Ceviche de pescado'),
   (SELECT id FROM ingredients WHERE name = 'tostada'),
   12, 'unidad', NULL, 'Para servir', 9, false);

   COMMIT;