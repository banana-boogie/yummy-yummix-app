-- Rename picture_url to image_url for consistency across codebase
-- Affects: ingredients, recipes, useful_items tables

ALTER TABLE ingredients RENAME COLUMN picture_url TO image_url;
ALTER TABLE recipes RENAME COLUMN picture_url TO image_url;
ALTER TABLE useful_items RENAME COLUMN picture_url TO image_url;
