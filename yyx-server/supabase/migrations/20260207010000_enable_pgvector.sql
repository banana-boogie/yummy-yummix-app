-- Enable pgvector extension for vector similarity search
-- Required for recipe_embeddings table (hybrid search, Ability 2)
-- Per irmixy-completion-plan.md Section 5.1

create extension if not exists vector
with schema extensions;
