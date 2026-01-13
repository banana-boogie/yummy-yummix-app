BEGIN;

-- Create indexes for faster tag lookups
CREATE INDEX IF NOT EXISTS recipe_to_tag_recipe_id_idx ON recipe_to_tag (recipe_id);
CREATE INDEX IF NOT EXISTS recipe_to_tag_tag_id_idx ON recipe_to_tag (tag_id);

-- Cazuela de panela con espinacas y caldillo
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Cazuela de panela con espinacas y caldillo'),
   (SELECT id FROM recipe_tags WHERE name = 'Plato fuerte')),
  ((SELECT id FROM recipes WHERE name = 'Cazuela de panela con espinacas y caldillo'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano')),
  ((SELECT id FROM recipes WHERE name = 'Cazuela de panela con espinacas y caldillo'),
   (SELECT id FROM recipe_tags WHERE name = 'Saludable'));

-- Calabacitas con elote y cilantro
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Calabacitas con elote y cilantro'),
   (SELECT id FROM recipe_tags WHERE name = 'Guarnición')),
  ((SELECT id FROM recipes WHERE name = 'Calabacitas con elote y cilantro'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano')),
  ((SELECT id FROM recipes WHERE name = 'Calabacitas con elote y cilantro'),
   (SELECT id FROM recipe_tags WHERE name = 'Saludable'));

-- Nieve rápida de fruta
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Nieve rápida de fruta'),
   (SELECT id FROM recipe_tags WHERE name = 'Postre')),
  ((SELECT id FROM recipes WHERE name = 'Nieve rápida de fruta'),
   (SELECT id FROM recipe_tags WHERE name = 'Dulce')),
  ((SELECT id FROM recipes WHERE name = 'Nieve rápida de fruta'),
   (SELECT id FROM recipe_tags WHERE name = 'Rápido'));

-- Crema de champiñones
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Crema de champiñones'),
   (SELECT id FROM recipe_tags WHERE name = 'Sopa')),
  ((SELECT id FROM recipes WHERE name = 'Crema de champiñones'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano')),
  ((SELECT id FROM recipes WHERE name = 'Crema de champiñones'),
   (SELECT id FROM recipe_tags WHERE name = 'Saludable'));

-- Galletas de mantequilla
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Galletas de mantequilla'),
   (SELECT id FROM recipe_tags WHERE name = 'Postre')),
  ((SELECT id FROM recipes WHERE name = 'Galletas de mantequilla'),
   (SELECT id FROM recipe_tags WHERE name = 'Dulce')),
  ((SELECT id FROM recipes WHERE name = 'Galletas de mantequilla'),
   (SELECT id FROM recipe_tags WHERE name = 'Botana'));

-- Pescado a la veracruzana
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM recipe_tags WHERE name = 'Plato fuerte')),
  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM recipe_tags WHERE name = 'Mariscos')),
  ((SELECT id FROM recipes WHERE name = 'Pescado a la veracruzana'),
   (SELECT id FROM recipe_tags WHERE name = 'Saludable'));

-- Cochinita pibil
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM recipe_tags WHERE name = 'Plato fuerte')),
  ((SELECT id FROM recipes WHERE name = 'Cochinita pibil'),
   (SELECT id FROM recipe_tags WHERE name = 'Comida'));

-- Espagueti carbonara
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Espagueti carbonara'),
   (SELECT id FROM recipe_tags WHERE name = 'Plato fuerte')),
  ((SELECT id FROM recipes WHERE name = 'Espagueti carbonara'),
   (SELECT id FROM recipe_tags WHERE name = 'Comida'));

-- Arroz negro cremoso con calamares
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Arroz negro cremoso con calamares'),
   (SELECT id FROM recipe_tags WHERE name = 'Plato fuerte')),
  ((SELECT id FROM recipes WHERE name = 'Arroz negro cremoso con calamares'),
   (SELECT id FROM recipe_tags WHERE name = 'Mariscos'));

-- Arroz blanco con verduras
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Arroz blanco con verduras'),
   (SELECT id FROM recipe_tags WHERE name = 'Guarnición')),
  ((SELECT id FROM recipes WHERE name = 'Arroz blanco con verduras'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano')),
  ((SELECT id FROM recipes WHERE name = 'Arroz blanco con verduras'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegano'));

-- Crema de verduras
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Crema de verduras'),
   (SELECT id FROM recipe_tags WHERE name = 'Sopa')),
  ((SELECT id FROM recipes WHERE name = 'Crema de verduras'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano')),
  ((SELECT id FROM recipes WHERE name = 'Crema de verduras'),
   (SELECT id FROM recipe_tags WHERE name = 'Saludable'));

-- Crema de espárragos y queso Brie
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Crema de espárragos y queso Brie'),
   (SELECT id FROM recipe_tags WHERE name = 'Sopa')),
  ((SELECT id FROM recipes WHERE name = 'Crema de espárragos y queso Brie'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano'));

-- Rajas con queso
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Rajas con queso'),
   (SELECT id FROM recipe_tags WHERE name = 'Guarnición')),
  ((SELECT id FROM recipes WHERE name = 'Rajas con queso'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano'));

-- Broccolini crujiente con salsa de ajos
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Broccolini crujiente con salsa de ajos'),
   (SELECT id FROM recipe_tags WHERE name = 'Guarnición')),
  ((SELECT id FROM recipes WHERE name = 'Broccolini crujiente con salsa de ajos'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano')),
  ((SELECT id FROM recipes WHERE name = 'Broccolini crujiente con salsa de ajos'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegano')),
  ((SELECT id FROM recipes WHERE name = 'Broccolini crujiente con salsa de ajos'),
   (SELECT id FROM recipe_tags WHERE name = 'Saludable'));

-- Arroz a la mexicana
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Arroz a la mexicana'),
   (SELECT id FROM recipe_tags WHERE name = 'Guarnición')),
  ((SELECT id FROM recipes WHERE name = 'Arroz a la mexicana'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano'));

-- Bolillos caseros
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Bolillos caseros'),
   (SELECT id FROM recipe_tags WHERE name = 'Pan')),
  ((SELECT id FROM recipes WHERE name = 'Bolillos caseros'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano'));

-- Baguette
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Baguette'),
   (SELECT id FROM recipe_tags WHERE name = 'Pan')),
  ((SELECT id FROM recipes WHERE name = 'Baguette'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano'));

-- Piña colada
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Piña colada'),
   (SELECT id FROM recipe_tags WHERE name = 'Bebida')),
  ((SELECT id FROM recipes WHERE name = 'Piña colada'),
   (SELECT id FROM recipe_tags WHERE name = 'Dulce'));

-- Mojito
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Mojito'),
   (SELECT id FROM recipe_tags WHERE name = 'Bebida')),
  ((SELECT id FROM recipes WHERE name = 'Mojito'),
   (SELECT id FROM recipe_tags WHERE name = 'Rápido'));

-- Sopa de tortilla
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM recipe_tags WHERE name = 'Sopa')),
  ((SELECT id FROM recipes WHERE name = 'Sopa de tortilla'),
   (SELECT id FROM recipe_tags WHERE name = 'Comida'));

-- Sopa de fideo
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Sopa de fideo'),
   (SELECT id FROM recipe_tags WHERE name = 'Sopa')),
  ((SELECT id FROM recipes WHERE name = 'Sopa de fideo'),
   (SELECT id FROM recipe_tags WHERE name = 'Comida'));

-- Sopa de cebolla
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Sopa de cebolla'),
   (SELECT id FROM recipe_tags WHERE name = 'Sopa')),
  ((SELECT id FROM recipes WHERE name = 'Sopa de cebolla'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano'));

-- Crema de calabacita
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM recipe_tags WHERE name = 'Sopa')),
  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano')),
  ((SELECT id FROM recipes WHERE name = 'Crema de calabacita'),
   (SELECT id FROM recipe_tags WHERE name = 'Saludable'));

-- Flan de queso crema
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Flan de queso crema'),
   (SELECT id FROM recipe_tags WHERE name = 'Postre')),
  ((SELECT id FROM recipes WHERE name = 'Flan de queso crema'),
   (SELECT id FROM recipe_tags WHERE name = 'Dulce'));

-- Fideo seco en salsa de chiles
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Fideo seco en salsa de chiles'),
   (SELECT id FROM recipe_tags WHERE name = 'Plato fuerte')),
  ((SELECT id FROM recipes WHERE name = 'Fideo seco en salsa de chiles'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano'));

-- Margarita de sandía y mango
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Margarita de sandía y mango'),
   (SELECT id FROM recipe_tags WHERE name = 'Bebida')),
  ((SELECT id FROM recipes WHERE name = 'Margarita de sandía y mango'),
   (SELECT id FROM recipe_tags WHERE name = 'Dulce')),
  ((SELECT id FROM recipes WHERE name = 'Margarita de sandía y mango'),
   (SELECT id FROM recipe_tags WHERE name = 'Rápido'));

-- Limonada
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Limonada'),
   (SELECT id FROM recipe_tags WHERE name = 'Bebida')),
  ((SELECT id FROM recipes WHERE name = 'Limonada'),
   (SELECT id FROM recipe_tags WHERE name = 'Rápido')),
  ((SELECT id FROM recipes WHERE name = 'Limonada'),
   (SELECT id FROM recipe_tags WHERE name = 'Express'));

-- Horchata de semillas de melón
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Horchata de semillas de melón'),
   (SELECT id FROM recipe_tags WHERE name = 'Bebida')),
  ((SELECT id FROM recipes WHERE name = 'Horchata de semillas de melón'),
   (SELECT id FROM recipe_tags WHERE name = 'Dulce')),
  ((SELECT id FROM recipes WHERE name = 'Horchata de semillas de melón'),
   (SELECT id FROM recipe_tags WHERE name = 'Express'));

-- Detox verde
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Detox verde'),
   (SELECT id FROM recipe_tags WHERE name = 'Bebida')),
  ((SELECT id FROM recipes WHERE name = 'Detox verde'),
   (SELECT id FROM recipe_tags WHERE name = 'Saludable')),
  ((SELECT id FROM recipes WHERE name = 'Detox verde'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegano')),
  ((SELECT id FROM recipes WHERE name = 'Detox verde'),
   (SELECT id FROM recipe_tags WHERE name = 'Express'));

-- Salpicón de res
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Salpicón de res'),
   (SELECT id FROM recipe_tags WHERE name = 'Plato fuerte')),
  ((SELECT id FROM recipes WHERE name = 'Salpicón de res'),
   (SELECT id FROM recipe_tags WHERE name = 'Comida')),
  ((SELECT id FROM recipes WHERE name = 'Salpicón de res'),
   (SELECT id FROM recipe_tags WHERE name = 'Saludable'));

-- Pan de caja blanco
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Pan de caja blanco'),
   (SELECT id FROM recipe_tags WHERE name = 'Pan')),
  ((SELECT id FROM recipes WHERE name = 'Pan de caja blanco'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano'));

-- Panqué de nuez glaseado
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM recipe_tags WHERE name = 'Postre')),
  ((SELECT id FROM recipes WHERE name = 'Panqué de nuez glaseado'),
   (SELECT id FROM recipe_tags WHERE name = 'Dulce'));

-- Pan de leche
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Pan de leche'),
   (SELECT id FROM recipe_tags WHERE name = 'Pan')),
  ((SELECT id FROM recipes WHERE name = 'Pan de leche'),
   (SELECT id FROM recipe_tags WHERE name = 'Vegetariano')),
  ((SELECT id FROM recipes WHERE name = 'Pan de leche'),
   (SELECT id FROM recipe_tags WHERE name = 'Desayuno'));

-- Tinga de pollo
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM recipe_tags WHERE name = 'Plato fuerte')),
  ((SELECT id FROM recipes WHERE name = 'Tinga de pollo'),
   (SELECT id FROM recipe_tags WHERE name = 'Comida'));

-- Pollo con mole
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Pollo con mole'),
   (SELECT id FROM recipe_tags WHERE name = 'Plato fuerte')),
  ((SELECT id FROM recipes WHERE name = 'Pollo con mole'),
   (SELECT id FROM recipe_tags WHERE name = 'Comida'));

-- Lasaña boloñesa
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Lasaña boloñesa'),
   (SELECT id FROM recipe_tags WHERE name = 'Plato fuerte')),
  ((SELECT id FROM recipes WHERE name = 'Lasaña boloñesa'),
   (SELECT id FROM recipe_tags WHERE name = 'Comida')),
  ((SELECT id FROM recipes WHERE name = 'Lasaña boloñesa'),
   (SELECT id FROM recipe_tags WHERE name = 'Horneado'));

-- Adobo con carne
INSERT INTO recipe_to_tag (recipe_id, tag_id) VALUES
  ((SELECT id FROM recipes WHERE name = 'Adobo con carne'),
   (SELECT id FROM recipe_tags WHERE name = 'Plato fuerte')),
  ((SELECT id FROM recipes WHERE name = 'Adobo con carne'),
   (SELECT id FROM recipe_tags WHERE name = 'Comida')),
  ((SELECT id FROM recipes WHERE name = 'Adobo con carne'),
   (SELECT id FROM recipe_tags WHERE name = 'Picante'));

COMMIT;