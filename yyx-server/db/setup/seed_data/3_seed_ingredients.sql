BEGIN;

-- Create index for faster ingredient searches
CREATE INDEX IF NOT EXISTS ingredients_name_idx ON ingredients (name);

INSERT INTO ingredients (name, plural_name, base_unit, nutritional_facts) VALUES
  -- Nuts (Nueces)
('nuez', 'nueces', 'g', '{
  "por_100g": {
    "calorias": 654,
    "proteina": 15.2,
    "carbohidratos": 13.7,
    "grasa": 65.2
  }
}'::jsonb),

-- Dairy (Lácteos)
('mantequilla', 'mantequilla', 'g', '{
  "por_100g": {
    "calorias": 717,
    "proteina": 0.9,
    "carbohidratos": 0.1,
    "grasa": 81.1
  }
}'::jsonb),

('mantequilla sin sal', 'mantequilla sin sal', 'g', '{
  "por_100g": {
    "calorias": 717,
    "proteina": 0.9,
    "carbohidratos": 0.1,
    "grasa": 81.1
  }
}'::jsonb),

('leche', 'leche', 'ml', '{
  "por_100ml": {
    "calorias": 62,
    "proteina": 3.3,
    "carbohidratos": 4.8,
    "grasa": 3.6
  }
}'::jsonb),

-- Dairy (Lácteos)
('leche condensada', 'leche condensada', 'ml', '{
  "por_100ml": {
    "calorias": 321,
    "proteina": 7.9,
    "carbohidratos": 54.4,
    "grasa": 8.7
  }
}'::jsonb),

('leche evaporada', 'leche evaporada', 'ml', '{
  "por_100ml": {
    "calorias": 134,
    "proteina": 6.8,
    "carbohidratos": 10.0,
    "grasa": 7.6
  }
}'::jsonb),

-- Flavorings (Saborizantes)
('vainilla', 'vainilla', 'ml', '{
  "por_100ml": {
    "calorias": 288,
    "proteina": 0.1,
    "carbohidratos": 12.7,
    "grasa": 0.1
  }
}'::jsonb),

-- Sauces & Syrups (Salsas y Jarabes)
('caramelo líquido', 'caramelo líquido', 'ml', '{
  "por_100ml": {
    "calorias": 280,
    "proteina": 0,
    "carbohidratos": 70,
    "grasa": 0
  }
}'::jsonb),

-- Basic Ingredients (Ingredientes Básicos)
('azúcar moscabada', 'azúcar moscabada', 'g', '{
  "por_100g": {
    "calorias": 380,
    "proteina": 0,
    "carbohidratos": 98.0,
    "grasa": 0
  }
}'::jsonb),

('harina de trigo', 'harina de trigo', 'g', '{
  "por_100g": {
    "calorias": 364,
    "proteina": 10.3,
    "carbohidratos": 76.3,
    "grasa": 1.0
  }
}'::jsonb),

('polvo para hornear', 'polvo para hornear', 'g', '{
  "por_100g": {
    "calorias": 53,
    "proteina": 0,
    "carbohidratos": 28,
    "grasa": 0
  }
}'::jsonb),

-- Leavening Agents (Levaduras)
('levadura prensada fresca', 'levadura prensada fresca', 'g', '{
  "por_100g": {
    "calorias": 105,
    "proteina": 16.7,
    "carbohidratos": 8.9,
    "grasa": 1.9
  }
}'::jsonb),

-- Leavening Agents (Levaduras)
('levadura seca instantánea', 'levadura seca instantánea', 'g', '{
  "por_100g": {
    "calorias": 325,
    "proteina": 40.4,
    "carbohidratos": 35.3,
    "grasa": 7.6
  }
}'::jsonb),

('sal', 'sal', 'g', '{
  "por_100g": {
    "calorias": 0,
    "proteina": 0,
    "carbohidratos": 0,
    "grasa": 0
  }
}'::jsonb),

-- Eggs (Huevos)
('huevo', 'huevos', 'g', '{
  "por_100g": {
    "calorias": 155,
    "proteina": 12.6,
    "carbohidratos": 1.1,
    "grasa": 10.9
  }
}'::jsonb),

-- Syrups (Jarabes)
('jarabe de maple', 'jarabe de maple', 'ml', '{
  "por_100ml": {
    "calorias": 260,
    "proteina": 0,
    "carbohidratos": 67,
    "grasa": 0
  }
}'::jsonb),

-- Basic Ingredients (Ingredientes Básicos)
('azúcar', 'azúcar', 'g', '{
  "por_100g": {
    "calorias": 387,
    "proteina": 0,
    "carbohidratos": 99.8,
    "grasa": 0
  }
}'::jsonb),

-- Oils & Fats (Aceites y Grasas)
('aceite', 'aceite', 'ml', '{
  "por_100ml": {
    "calorias": 884,
    "proteina": 0,
    "carbohidratos": 0,
    "grasa": 100
  }
}'::jsonb),

-- Citrus & Juices (Cítricos y Jugos)
('jugo de limón', 'jugo de limón', 'ml', '{
  "por_100ml": {
    "calorias": 22,
    "proteina": 0.4,
    "carbohidratos": 7,
    "grasa": 0.2
  }
}'::jsonb),

-- Ice (Hielo)
('hielo', 'hielos', 'g', '{
  "por_100g": {
    "calorias": 0,
    "proteina": 0,
    "carbohidratos": 0,
    "grasa": 0
  }
}'::jsonb),
-- Beverages (Bebidas)
('agua', 'agua', 'ml', '{
  "por_100ml": {
    "calorias": 0,
    "proteina": 0,
    "carbohidratos": 0,
    "grasa": 0
  }
}'::jsonb),
('agua mineral', 'agua mineral', 'ml', '{
  "por_100ml": {
    "calorias": 0,
    "proteina": 0,
    "carbohidratos": 0,
    "grasa": 0
  }
}'::jsonb),

-- Fruits (Frutas)
('piña', 'piña', 'g', '{
  "por_100g": {
    "calorias": 50,
    "proteina": 0.5,
    "carbohidratos": 13.1,
    "grasa": 0.1
  }
}'::jsonb),

-- Fruits (Frutas)
('mango', 'mango', 'g', '{
  "por_100g": {
    "calorias": 60,
    "proteina": 0.8,
    "carbohidratos": 15,
    "grasa": 0.4
  }
}'::jsonb),

('lima', 'limas', 'g', '{
  "por_100g": {
    "calorias": 30,
    "proteina": 0.7,
    "carbohidratos": 10.5,
    "grasa": 0.2
  }
}'::jsonb),

('fresa', 'fresa', 'g', '{
  "por_100g": {
    "calorias": 32,
    "proteina": 0.7,
    "carbohidratos": 7.7,
    "grasa": 0.3
  }
}'::jsonb),


-- Dairy & Alternatives (Lácteos y Alternativas)
('leche de coco', 'leche de coco', 'ml', '{
  "por_100ml": {
    "calorias": 230,
    "proteina": 2.3,
    "carbohidratos": 5.5,
    "grasa": 24
  }
}'::jsonb),

-- Alcoholic Beverages (Bebidas Alcohólicas)
('ron', 'ron', 'ml', '{
  "por_100ml": {
    "calorias": 231,
    "proteina": 0,
    "carbohidratos": 0,
    "grasa": 0
  }
}'::jsonb),

('ron blanco', 'ron blanco', 'ml', '{
  "por_100ml": {
    "calorias": 231,
    "proteina": 0,
    "carbohidratos": 0,
    "grasa": 0
  }
}'::jsonb),

('menta fresca', 'menta fresca', 'g', '{
  "por_100g": {
    "calorias": 44,
    "proteina": 3.3,
    "carbohidratos": 8.4,
    "grasa": 0.7
  }
}'::jsonb),

-- Garnishes (Guarniciones)
('coco rallado', 'coco rallado', 'g', '{
  "por_100g": {
    "calorias": 354,
    "proteina": 3.3,
    "carbohidratos": 15,
    "grasa": 33.5
  }
}'::jsonb),

-- Fruits (Frutas)
('sandía', 'sandía', 'g', '{
  "por_100g": {
    "calorias": 30,
    "proteina": 0.6,
    "carbohidratos": 7.6,
    "grasa": 0.2
  }
}'::jsonb),

-- Alcoholic Beverages (Bebidas Alcohólicas)
('tequila', 'tequila', 'ml', '{
  "por_100ml": {
    "calorias": 231,
    "proteina": 0,
    "carbohidratos": 0,
    "grasa": 0
  }
}'::jsonb),

-- Condiments (Condimentos)
('chamoy', 'chamoy', 'g', '{
  "por_100g": {
    "calorias": 247,
    "proteina": 0,
    "carbohidratos": 62,
    "grasa": 0
  }
}'::jsonb),

-- Seeds (Semillas)
('semillas de melón', 'semillas de melón', 'g', '{
  "por_100g": {
    "calorias": 557,
    "proteina": 28.3,
    "carbohidratos": 8.6,
    "grasa": 47.7
  }
}'::jsonb),

-- Spices (Especias)
('canela', 'canela', 'g', '{
  "por_100g": {
    "calorias": 247,
    "proteina": 3.9,
    "carbohidratos": 80.6,
    "grasa": 1.2
  }
}'::jsonb),

-- Fruits (Frutas)
('manzana verde', 'manzana verde', 'g', '{
  "por_100g": {
    "calorias": 52,
    "proteina": 0.3,
    "carbohidratos": 14,
    "grasa": 0.2
  }
}'::jsonb),

-- Vegetables (Verduras)
('kale', 'kales', 'g', '{
  "por_100g": {
    "calorias": 49,
    "proteina": 4.3,
    "carbohidratos": 8.8,
    "grasa": 0.9
  }
}'::jsonb),

('pepino', 'pepinos', 'g', '{
  "por_100g": {
    "calorias": 15,
    "proteina": 0.7,
    "carbohidratos": 3.6,
    "grasa": 0.1
  }
}'::jsonb),

('apio', 'apio', 'g', '{
  "por_100g": {
    "calorias": 16,
    "proteina": 0.7,
    "carbohidratos": 3,
    "grasa": 0.2
  }
}'::jsonb),

-- Dairy (Lácteos)
('queso chihuahua', 'queso chihuahua', 'g', '{
  "por_100g": {
    "calorias": 356,
    "proteina": 23,
    "carbohidratos": 2.7,
    "grasa": 28
  }
}'::jsonb),

('crema ácida', 'crema ácida', 'g', '{
  "por_100g": {
    "calorias": 193,
    "proteina": 2.1,
    "carbohidratos": 4.6,
    "grasa": 18.5
  }
}'::jsonb),

-- Vegetables (Verduras)
('granos de elote', 'granos de elote', 'g', '{
  "por_100g": {
    "calorias": 86,
    "proteina": 3.2,
    "carbohidratos": 19,
    "grasa": 1.2
  }
}'::jsonb),

('chile poblano', 'chile poblano', 'g', '{
  "por_100g": {
    "calorias": 40,
    "proteina": 2,
    "carbohidratos": 9,
    "grasa": 0.4
  }
}'::jsonb),

-- Vegetables (Verduras)
('jitomate', 'jitomate', 'g', '{
  "por_100g": {
    "calorias": 18,
    "proteina": 0.9,
    "carbohidratos": 3.9,
    "grasa": 0.2
  }
}'::jsonb),

('espinaca fresca', 'espinaca fresca', 'g', '{
  "por_100g": {
    "calorias": 23,
    "proteina": 2.9,
    "carbohidratos": 3.6,
    "grasa": 0.4
  }
}'::jsonb),

-- Dairy (Lácteos)
('queso panela', 'queso panela', 'g', '{
  "por_100g": {
    "calorias": 215,
    "proteina": 18,
    "carbohidratos": 3,
    "grasa": 16
  }
}'::jsonb),

-- Spices (Especias)
('comino', 'comino', 'g', '{
  "por_100g": {
    "calorias": 375,
    "proteina": 17.8,
    "carbohidratos": 44.2,
    "grasa": 22.3
  }
}'::jsonb),

-- Spices (Especias)
('pimienta negra', 'pimienta negra', 'g', '{
  "por_100g": {
    "calorias": 251,
    "proteina": 10.4,
    "carbohidratos": 63.9,
    "grasa": 3.3
  }
}'::jsonb),

-- Herbs (Hierbas)
('cilantro', 'cilantro', 'g', '{
  "por_100g": {
    "calorias": 23,
    "proteina": 2.1,
    "carbohidratos": 3.7,
    "grasa": 0.5
  }
}'::jsonb),

-- Vegetables (Verduras)
('calabacita', 'calabacita', 'g', '{
  "por_100g": {
    "calorias": 17,
    "proteina": 1.2,
    "carbohidratos": 3.1,
    "grasa": 0.3
  }
}'::jsonb),

('puré de tomate', 'puré de tomate', 'g', '{
  "por_100g": {
    "calorias": 38,
    "proteina": 1.5,
    "carbohidratos": 8.5,
    "grasa": 0.2
  }
}'::jsonb),


-- Sweeteners (Endulzantes)
('azúcar moreno', 'azúcar moreno', 'g', '{
  "por_100g": {
    "calorias": 380,
    "proteina": 0,
    "carbohidratos": 98,
    "grasa": 0
  }
}'::jsonb),

-- Vegetables (Verduras)
('broccolini', 'broccolini', 'g', '{
  "por_100g": {
    "calorias": 35,
    "proteina": 3.3,
    "carbohidratos": 7,
    "grasa": 0.4
  }
}'::jsonb),

-- Alcoholic Beverages (Bebidas Alcohólicas)
('vino blanco', 'vino blanco', 'ml', '{
  "por_100ml": {
    "calorias": 82,
    "proteina": 0.1,
    "carbohidratos": 2.6,
    "grasa": 0
  }
}'::jsonb),

-- Condiments (Condimentos)
('salsa de soja', 'salsa de soja', 'ml', '{
  "por_100ml": {
    "calorias": 53,
    "proteina": 8.1,
    "carbohidratos": 4.9,
    "grasa": 0
  }
}'::jsonb),

-- Vegetables (Verduras)
('lechuga romana', 'lechuga romana', 'g', '{
  "por_100g": {
    "calorias": 17,
    "proteina": 1.2,
    "carbohidratos": 3.3,
    "grasa": 0.3
  }
}'::jsonb),

('cebolla morada', 'cebolla morada', 'g', '{
  "por_100g": {
    "calorias": 40,
    "proteina": 1.1,
    "carbohidratos": 9.3,
    "grasa": 0.1
  }
}'::jsonb),

-- Condiments (Condimentos)
('vinagre de vino blanco', 'vinagre de vino blanco', 'ml', '{
  "por_100ml": {
    "calorias": 18,
    "proteina": 0,
    "carbohidratos": 0.9,
    "grasa": 0
  }
}'::jsonb),

-- Meats (Carnes)
('falda de res', 'falda de res', 'g', '{
  "por_100g": {
    "calorias": 213,
    "proteina": 28.5,
    "carbohidratos": 0,
    "grasa": 11.2
  }
}'::jsonb),

-- Fruits (Frutas)
('aguacate', 'aguacate', 'g', '{
  "por_100g": {
    "calorias": 160,
    "proteina": 2,
    "carbohidratos": 8.5,
    "grasa": 14.7
  }
}'::jsonb),

-- Bread & Crackers (Pan y Galletas)
('tostadas', 'tostadas', 'g', '{
  "por_100g": {
    "calorias": 428,
    "proteina": 8.5,
    "carbohidratos": 77.2,
    "grasa": 9.8
  }
}'::jsonb),


-- Meats (Carnes)
('pechuga de pollo', 'pechuga de pollo', 'g', '{
  "por_100g": {
    "calorias": 165,
    "proteina": 31,
    "carbohidratos": 0,
    "grasa": 3.6
  }
}'::jsonb),

-- Condiments (Condimentos)
('caldo de pollo', 'caldo de pollo', 'cubo', '{
  "por_100g": {
    "calorias": 259,
    "proteina": 13.4,
    "carbohidratos": 17.4,
    "grasa": 16.3
  }
}'::jsonb),

('chile chipotle adobado', 'chile chipotle adobado', 'g', '{
  "por_100g": {
    "calorias": 140,
    "proteina": 4.1,
    "carbohidratos": 22.5,
    "grasa": 4.3
  }
}'::jsonb),

-- Herbs & Spices (Hierbas y Especias)
('laurel', 'laurel', 'g', '{
  "por_100g": {
    "calorias": 313,
    "proteina": 7.6,
    "carbohidratos": 74.9,
    "grasa": 8.4
  }
}'::jsonb),

-- Vegetables (Verduras)
('jitomate guaje', 'jitomate guaje', 'g', '{
  "por_100g": {
    "calorias": 18,
    "proteina": 0.9,
    "carbohidratos": 3.9,
    "grasa": 0.2
  }
}'::jsonb),

-- Chiles & Peppers (Chiles y Pimientos)
('chile mulato', 'chiles mulatos', 'g', '{
  "por_100g": {
    "calorias": 324,
    "proteina": 12.2,
    "carbohidratos": 54.8,
    "grasa": 7.8
  }
}'::jsonb),

('chile ancho', 'chiles anchos', 'g', '{
  "por_100g": {
    "calorias": 281,
    "proteina": 13,
    "carbohidratos": 54.8,
    "grasa": 7.1
  }
}'::jsonb),

('chile chipotle', 'chiles chipotles', 'g', '{
  "por_100g": {
    "calorias": 310,
    "proteina": 12.8,
    "carbohidratos": 53.9,
    "grasa": 8.6
  }
}'::jsonb),

-- Herbs & Spices (Hierbas y Especias)
('romero', 'romero', 'g', '{
  "por_100g": {
    "calorias": 131,
    "proteina": 3.3,
    "carbohidratos": 20.7,
    "grasa": 5.9
  }
}'::jsonb),

('tomillo', 'tomillo', 'g', '{
  "por_100g": {
    "calorias": 101,
    "proteina": 5.6,
    "carbohidratos": 24.5,
    "grasa": 1.7
  }
}'::jsonb),

('pimienta gorda', 'pimientas gordas', 'g', '{
  "por_100g": {
    "calorias": 263,
    "proteina": 6.1,
    "carbohidratos": 72.1,
    "grasa": 8.7
  }
}'::jsonb),

('ajonjolí', 'ajonjolí', 'g', '{
  "por_100g": {
    "calorias": 573,
    "proteina": 17.7,
    "carbohidratos": 23.4,
    "grasa": 49.7
  }
}'::jsonb),

-- Nuts & Seeds (Nueces y Semillas)
('almendra', 'almendras', 'g', '{
  "por_100g": {
    "calorias": 579,
    "proteina": 21.2,
    "carbohidratos": 21.7,
    "grasa": 49.9
  }
}'::jsonb),

('pepita de calabaza', 'pepitas de calabaza', 'g', '{
  "por_100g": {
    "calorias": 559,
    "proteina": 30.2,
    "carbohidratos": 10.7,
    "grasa": 49
  }
}'::jsonb),

('cacahuate', 'cacahuates', 'g', '{
  "por_100g": {
    "calorias": 567,
    "proteina": 25.8,
    "carbohidratos": 16.1,
    "grasa": 49.2
  }
}'::jsonb),

-- Dried Fruits (Frutas Secas)
('pasas', 'pasas', 'g', '{
  "por_100g": {
    "calorias": 299,
    "proteina": 3.1,
    "carbohidratos": 79.2,
    "grasa": 0.5
  }
}'::jsonb),

-- Bread (Pan)
('bolillo', 'bolillo', 'g', '{
  "por_100g": {
    "calorias": 272,
    "proteina": 9.1,
    "carbohidratos": 56,
    "grasa": 1.2
  }
}'::jsonb),

-- Fats (Grasas)
('manteca de cerdo', 'manteca de cerdo', 'g', '{
  "por_100g": {
    "calorias": 902,
    "proteina": 0,
    "carbohidratos": 0,
    "grasa": 100
  }
}'::jsonb),

-- Sweets (Dulces)
('chocolate de mesa', 'chocolate de mesa', 'g', '{
  "por_100g": {
    "calorias": 545,
    "proteina": 4.7,
    "carbohidratos": 59.4,
    "grasa": 31.3
  }
}'::jsonb),

-- Condiments (Condimentos)
('alcaparras', 'alcaparras', 'g', '{
  "por_100g": {
    "calorias": 23,
    "proteina": 2.4,
    "carbohidratos": 4.9,
    "grasa": 0.2
  }
}'::jsonb),

('aceitunas verdes', 'aceitunas verdes', 'g', '{
  "por_100g": {
    "calorias": 145,
    "proteina": 1,
    "carbohidratos": 3.8,
    "grasa": 15.3
  }
}'::jsonb),

-- Fish (Pescado)
('pescado blanco', 'pescado blanco', 'g', '{
  "por_100g": {
    "calorias": 96,
    "proteina": 20.5,
    "carbohidratos": 0,
    "grasa": 1.3
  }
}'::jsonb),

-- Peppers (Chiles)
('chile güero', 'chiles güeros', 'g', '{
  "por_100g": {
    "calorias": 40,
    "proteina": 1.9,
    "carbohidratos": 9.5,
    "grasa": 0.2
  }
}'::jsonb),

-- Herbs & Spices (Hierbas y Especias)
('orégano', 'orégano', 'g', '{
  "por_100g": {
    "calorias": 265,
    "proteina": 9,
    "carbohidratos": 69,
    "grasa": 4.3
  }
}'::jsonb),

('achiote', 'achiote', 'g', '{
  "por_100g": {
    "calorias": 282,
    "proteina": 13,
    "carbohidratos": 21.5,
    "grasa": 18.9
  }
}'::jsonb),

-- Condiments (Condimentos)
('vinagre blanco', 'vinagre blanco', 'ml', '{
  "por_100ml": {
    "calorias": 18,
    "proteina": 0,
    "carbohidratos": 0.9,
    "grasa": 0
  }
}'::jsonb),

-- Beverages (Bebidas)
('jugo de naranja', 'jugo de naranja', 'ml', '{
  "por_100ml": {
    "calorias": 45,
    "proteina": 0.7,
    "carbohidratos": 10.4,
    "grasa": 0.2
  }
}'::jsonb),

-- Meats (Carnes)
('pernil de cerdo', 'pernil de cerdo', 'g', '{
  "por_100g": {
    "calorias": 242,
    "proteina": 27,
    "carbohidratos": 0,
    "grasa": 15
  }
}'::jsonb),

-- Chiles (Chiles)
('chile guajillo', 'chile guajillo', 'g', '{
  "por_100g": {
    "calorias": 282,
    "proteina": 13,
    "carbohidratos": 54.8,
    "grasa": 7.1
  }
}'::jsonb),

('chile pasilla', 'chile pasilla', 'g', '{
  "por_100g": {
    "calorias": 281,
    "proteina": 13.9,
    "carbohidratos": 54.1,
    "grasa": 7.8
  }
}'::jsonb),

-- Spices (Especias)
('clavo de olor', 'clavo de olor', 'g', '{
  "por_100g": {
    "calorias": 274,
    "proteina": 5.9,
    "carbohidratos": 65.5,
    "grasa": 13
  }
}'::jsonb),

-- Condiments (Condimentos)
('vinagre de manzana', 'vinagre de manzana', 'ml', '{
  "por_100ml": {
    "calorias": 21,
    "proteina": 0,
    "carbohidratos": 0.9,
    "grasa": 0
  }
}'::jsonb),

('caldo de res', 'caldo de res', 'cubo', '{
  "por_100g": {
    "calorias": 259,
    "proteina": 13.4,
    "carbohidratos": 17.4,
    "grasa": 16.3
  }
}'::jsonb),

-- Meats (Carnes)
('lomo de cerdo', 'lomo de cerdo', 'g', '{
  "por_100g": {
    "calorias": 242,
    "proteina": 27,
    "carbohidratos": 0,
    "grasa": 15
  }
}'::jsonb),

-- Dairy (Lácteos)
('queso parmesano', 'queso parmesano', 'g', '{
  "por_100g": {
    "calorias": 431,
    "proteina": 38,
    "carbohidratos": 4.1,
    "grasa": 29
  }
}'::jsonb),

-- Vegetables (Verduras)
('zanahoria', 'zanahoria', 'g', '{
  "por_100g": {
    "calorias": 41,
    "proteina": 0.9,
    "carbohidratos": 9.6,
    "grasa": 0.2
  }
}'::jsonb),

('pimiento rojo', 'pimiento rojo', 'g', '{
  "por_100g": {
    "calorias": 31,
    "proteina": 1,
    "carbohidratos": 6.3,
    "grasa": 0.3
  }
}'::jsonb),

('champiñones', 'champiñones', 'g', '{
  "por_100g": {
    "calorias": 22,
    "proteina": 3.1,
    "carbohidratos": 3.3,
    "grasa": 0.3
  }
}'::jsonb),

-- Meats (Carnes)
('carne molida de res', 'carne molida de res', 'g', '{
  "por_100g": {
    "calorias": 332,
    "proteina": 14.3,
    "carbohidratos": 0,
    "grasa": 30.5
  }
}'::jsonb),

-- Condiments (Condimentos)
('caldo de carne', 'caldo de carne', 'cubo', '{
  "por_100g": {
    "calorias": 259,
    "proteina": 13.4,
    "carbohidratos": 17.4,
    "grasa": 16.3
  }
}'::jsonb),

-- Baking (Panadería)
('harina', 'harina', 'g', '{
  "por_100g": {
    "calorias": 364,
    "proteina": 10,
    "carbohidratos": 76,
    "grasa": 1
  }
}'::jsonb),

-- Spices (Especias)
('nuez moscada', 'nuez moscada', 'g', '{
  "por_100g": {
    "calorias": 525,
    "proteina": 5.8,
    "carbohidratos": 49.3,
    "grasa": 36.3
  }
}'::jsonb),

-- Pasta (Pasta)
('pasta para lasaña', 'pasta para lasaña', 'g', '{
  "por_100g": {
    "calorias": 371,
    "proteina": 13,
    "carbohidratos": 75,
    "grasa": 1.5
  }
}'::jsonb),

-- Dairy (Lácteos)
('queso cotija', 'queso cotija', 'g', '{
  "por_100g": {
    "calorias": 355,
    "proteina": 24.1,
    "carbohidratos": 3.3,
    "grasa": 28.9
  }
}'::jsonb),

-- Chiles (Chiles)
('chile morita', 'chile morita', 'g', '{
  "por_100g": {
    "calorias": 282,
    "proteina": 12.8,
    "carbohidratos": 54.8,
    "grasa": 7.1
  }
}'::jsonb),

('chile cascabel', 'chile cascabel', 'g', '{
  "por_100g": {
    "calorias": 324,
    "proteina": 12.2,
    "carbohidratos": 54.8,
    "grasa": 7.8
  }
}'::jsonb),

-- Pasta (Pasta)
('fideos', 'fideos', 'g', '{
  "por_100g": {
    "calorias": 371,
    "proteina": 13,
    "carbohidratos": 75,
    "grasa": 1.5
  }
}'::jsonb),

-- Dairy (Lácteos)
('queso pecorino', 'queso pecorino', 'g', '{
  "por_100g": {
    "calorias": 387,
    "proteina": 26,
    "carbohidratos": 0,
    "grasa": 32
  }
}'::jsonb),

-- Vegetables (Verduras)
('echalot', 'echalot', 'g', '{
  "por_100g": {
    "calorias": 72,
    "proteina": 2.5,
    "carbohidratos": 16.8,
    "grasa": 0.1
  }
}'::jsonb),

-- Meats (Carnes)
('tocino ahumado', 'tocino ahumado', 'g', '{
  "por_100g": {
    "calorias": 541,
    "proteina": 37,
    "carbohidratos": 1.4,
    "grasa": 42
  }
}'::jsonb),

-- Pasta (Pasta)
('spaghetti', 'spaghetti', 'g', '{
  "por_100g": {
    "calorias": 371,
    "proteina": 13,
    "carbohidratos": 75,
    "grasa": 1.5
  }
}'::jsonb),


('yema de huevo', 'yema de huevo', 'g', '{
  "por_100g": {
    "calorias": 322,
    "proteina": 16,
    "carbohidratos": 3.6,
    "grasa": 27
  }
}'::jsonb),

-- Seafood (Mariscos)
('calamar', 'calamares', 'g', '{
  "por_100g": {
    "calorias": 92,
    "proteina": 15.6,
    "carbohidratos": 3,
    "grasa": 1.4
  }
}'::jsonb),

-- Condiments (Condimentos)
('tinta de calamar', 'tinta de calamar', 'g', '{
  "por_100g": {
    "calorias": 85,
    "proteina": 12.5,
    "carbohidratos": 3.8,
    "grasa": 2.3
  }
}'::jsonb),

('caldo de pescado', 'caldo de pescado', 'g', '{
  "por_100g": {
    "calorias": 39,
    "proteina": 8.3,
    "carbohidratos": 0.5,
    "grasa": 0.4
  }
}'::jsonb),

-- Grains (Granos)
('arroz redondo', 'arroz redondo', 'g', '{
  "por_100g": {
    "calorias": 360,
    "proteina": 7,
    "carbohidratos": 79,
    "grasa": 0.6
  }
}'::jsonb),

-- Canned Goods (Conservas)
('tomate triturado', 'tomate triturado', 'g', '{
  "por_100g": {
    "calorias": 32,
    "proteina": 1.6,
    "carbohidratos": 7,
    "grasa": 0.2
  }
}'::jsonb),

-- Grains (Granos)
('arroz', 'arroz', 'g', '{
  "por_100g": {
    "calorias": 360,
    "proteina": 7,
    "carbohidratos": 79,
    "grasa": 0.6
  }
}'::jsonb),

-- Vegetables (Verduras)
('chícharos', 'chícharos', 'g', '{
  "por_100g": {
    "calorias": 81,
    "proteina": 5.4,
    "carbohidratos": 14,
    "grasa": 0.4
  }
}'::jsonb),

-- Condiments (Condimentos)
('caldo de tomate', 'caldo de tomate', 'cubo', '{
  "por_100g": {
    "calorias": 259,
    "proteina": 13.4,
    "carbohidratos": 17.4,
    "grasa": 16.3
  }
}'::jsonb),

-- Frozen Foods (Alimentos Congelados)
('mezcla de verduras', 'mezcla de verduras', 'g', '{
  "por_100g": {
    "calorias": 65,
    "proteina": 3.6,
    "carbohidratos": 11.8,
    "grasa": 0.6
  }
}'::jsonb),

-- Dairy (Lácteos)
('queso gruyère', 'queso gruyère', 'g', '{
  "por_100g": {
    "calorias": 413,
    "proteina": 30,
    "carbohidratos": 0.4,
    "grasa": 32
  }
}'::jsonb),

-- Bread (Pan)
('baguette', 'baguette', 'g', '{
  "por_100g": {
    "calorias": 274,
    "proteina": 9,
    "carbohidratos": 52,
    "grasa": 3
  }
}'::jsonb),

-- Tortillas & Bread (Tortillas y Pan)
('tortilla de maíz', 'tortillas de maíz', 'g', '{
  "por_100g": {
    "calorias": 218,
    "proteina": 5.4,
    "carbohidratos": 46,
    "grasa": 2.9
  }
}'::jsonb),


-- Vegetables (Verduras)
('chile verde', 'chiles verdes', 'g', '{
  "por_100g": {
    "calorias": 40,
    "proteina": 2,
    "carbohidratos": 9,
    "grasa": 0.2
  }
}'::jsonb),

-- Meats (Carnes)
('chicharrón', 'chicharrón', 'g', '{
  "por_100g": {
    "calorias": 544,
    "proteina": 61,
    "carbohidratos": 0,
    "grasa": 33
  }
}'::jsonb),

-- Vegetables (Verduras)
('papa', 'papas', 'g', '{
  "por_100g": {
    "calorias": 77,
    "proteina": 2,
    "carbohidratos": 17,
    "grasa": 0.1
  }
}'::jsonb),

('poro', 'poros', 'g', '{
  "por_100g": {
    "calorias": 61,
    "proteina": 1.5,
    "carbohidratos": 14.2,
    "grasa": 0.3
  }
}'::jsonb),

-- Herbs (Hierbas)
('perejil', 'perejiles', 'g', '{
  "por_100g": {
    "calorias": 36,
    "proteina": 3,
    "carbohidratos": 6.3,
    "grasa": 0.8
  }
}'::jsonb),

-- Dairy (Lácteos)
('crema', 'crema', 'g', '{
  "por_100g": {
    "calorias": 345,
    "proteina": 2.1,
    "carbohidratos": 3.4,
    "grasa": 35
  }
}'::jsonb),

('queso crema', 'queso crema', 'g', '{
  "por_100g": {
    "calorias": 342,
    "proteina": 5.9,
    "carbohidratos": 4.1,
    "grasa": 34.2
  }
}'::jsonb),

-- Condiments (Condimentos)
('caldo de verdura', 'caldo de verdura', 'cubo', '{
  "por_100g": {
    "calorias": 259,
    "proteina": 13.4,
    "carbohidratos": 17.4,
    "grasa": 16.3
  }
}'::jsonb),

-- Vegetables (Verduras)
('espárragos', 'espárragos', 'g', '{
  "por_100g": {
    "calorias": 20,
    "proteina": 2.2,
    "carbohidratos": 3.9,
    "grasa": 0.2
  }
}'::jsonb),

-- Dairy (Lácteos)
('queso brie', 'queso brie', 'g', '{
  "por_100g": {
    "calorias": 334,
    "proteina": 20.8,
    "carbohidratos": 0.5,
    "grasa": 27.7
  }
}'::jsonb);


COMMIT;