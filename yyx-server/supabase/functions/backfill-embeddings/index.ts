/**
 * Backfill Embeddings Edge Function
 *
 * Generates vector embeddings for published recipes using OpenAI text-embedding-3-large.
 * Service-role auth required. Idempotent via content hash.
 * Per irmixy-completion-plan.md Sections 5.5, 5.6
 *
 * Usage:
 *   curl -X POST https://<project>.supabase.co/functions/v1/backfill-embeddings \
 *     -H "Authorization: Bearer <service-role-key>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"batchSize": 50, "dryRun": false, "forceRegenerate": false}'
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ============================================================
// Types
// ============================================================

interface BackfillParams {
  batchSize: number;
  dryRun: boolean;
  forceRegenerate: boolean;
}

interface RecipeForEmbedding {
  id: string;
  name_en: string | null;
  name_es: string | null;
  tips_and_tricks_en: string | null;
  tips_and_tricks_es: string | null;
  recipe_ingredients: Array<{
    ingredients: {
      name_en: string | null;
      name_es: string | null;
    } | null;
  }>;
  recipe_to_tag: Array<{
    recipe_tags: {
      name_en: string | null;
      name_es: string | null;
    } | null;
  }>;
  recipe_steps: Array<{
    instruction_en: string | null;
    instruction_es: string | null;
    order: number;
  }>;
}

interface BatchResult {
  batch: number;
  processed: number;
  skipped: number;
  errors: number;
  errorMessages: string[];
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 200;
const MAX_RETRIES = 3;
const EMBEDDING_MODEL = "text-embedding-3-large";

// ============================================================
// Content Hash
// ============================================================

/**
 * Compute SHA-256 content hash for a recipe.
 * Hash = SHA-256(embedding_model|full_embedding_text)
 */
async function computeContentHash(embeddingText: string): Promise<string> {
  const content = `${EMBEDDING_MODEL}|${embeddingText}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================
// Embedding Text Builder
// ============================================================

/**
 * Build rich bilingual text for embedding generation.
 * Includes recipe name, ingredients, tags, tips, and first few steps
 * in both EN and ES for cross-language search support.
 */
function buildEmbeddingText(recipe: RecipeForEmbedding): string {
  const sections: string[] = [];

  // Recipe names
  if (recipe.name_en) sections.push(`Recipe: ${recipe.name_en}`);
  if (recipe.name_es) sections.push(`Receta: ${recipe.name_es}`);

  // Ingredients (both languages)
  const ingredientsEN = (recipe.recipe_ingredients || [])
    .map((ri) => ri.ingredients?.name_en)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));
  const ingredientsES = (recipe.recipe_ingredients || [])
    .map((ri) => ri.ingredients?.name_es)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));

  if (ingredientsEN.length > 0) {
    sections.push(`Ingredients: ${ingredientsEN.join(", ")}`);
  }
  if (ingredientsES.length > 0) {
    sections.push(`Ingredientes: ${ingredientsES.join(", ")}`);
  }

  // Tags (both languages)
  const tagsEN = (recipe.recipe_to_tag || [])
    .map((rt) => rt.recipe_tags?.name_en)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));
  const tagsES = (recipe.recipe_to_tag || [])
    .map((rt) => rt.recipe_tags?.name_es)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));

  if (tagsEN.length > 0) sections.push(`Tags: ${tagsEN.join(", ")}`);
  if (tagsES.length > 0) sections.push(`Etiquetas: ${tagsES.join(", ")}`);

  // Tips (both languages, first 200 chars each)
  if (recipe.tips_and_tricks_en) {
    sections.push(
      `Tips: ${recipe.tips_and_tricks_en.slice(0, 200)}`,
    );
  }
  if (recipe.tips_and_tricks_es) {
    sections.push(
      `Consejos: ${recipe.tips_and_tricks_es.slice(0, 200)}`,
    );
  }

  // First 3 steps (EN only, for instruction context)
  const sortedSteps = (recipe.recipe_steps || [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);
  for (const step of sortedSteps) {
    if (step.instruction_en) {
      sections.push(`Step ${step.order}: ${step.instruction_en.slice(0, 150)}`);
    }
  }

  return sections.join("\n");
}

// ============================================================
// OpenAI Embedding API
// ============================================================

/**
 * Call OpenAI embeddings API with retry.
 */
async function generateEmbedding(
  text: string,
  apiKey: string,
): Promise<number[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenAI API error (${response.status}): ${errorText}`,
        );
      }

      const data = await response.json();
      const embedding = data?.data?.[0]?.embedding;

      if (!Array.isArray(embedding)) {
        throw new Error("Invalid embedding response from OpenAI");
      }

      return embedding;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(
          `[backfill] Attempt ${attempt} failed, retrying in ${delay}ms:`,
          lastError.message,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error("Failed to generate embedding after retries");
}

// ============================================================
// Main Backfill Logic
// ============================================================

async function runBackfill(params: BackfillParams): Promise<{
  totalRecipes: number;
  totalProcessed: number;
  totalSkipped: number;
  totalErrors: number;
  batches: BatchResult[];
}> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!openaiApiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch all published recipes with related data
  const { data: recipes, error: fetchError } = await supabase
    .from("recipes")
    .select(`
      id,
      name_en,
      name_es,
      tips_and_tricks_en,
      tips_and_tricks_es,
      recipe_ingredients ( ingredients ( name_en, name_es ) ),
      recipe_to_tag ( recipe_tags ( name_en, name_es ) ),
      recipe_steps ( instruction_en, instruction_es, order )
    `)
    .eq("is_published", true)
    .order("created_at", { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to fetch recipes: ${fetchError.message}`);
  }

  if (!recipes || recipes.length === 0) {
    return {
      totalRecipes: 0,
      totalProcessed: 0,
      totalSkipped: 0,
      totalErrors: 0,
      batches: [],
    };
  }

  const typedRecipes = recipes as unknown as RecipeForEmbedding[];
  console.log(`[backfill] Found ${typedRecipes.length} published recipes`);

  // Fetch existing embeddings for hash comparison (skip unchanged)
  const { data: existingEmbeddings } = await supabase
    .from("recipe_embeddings")
    .select("recipe_id, content_hash");

  const existingHashMap = new Map(
    (existingEmbeddings || []).map((
      e: { recipe_id: string; content_hash: string },
    ) => [
      e.recipe_id,
      e.content_hash,
    ]),
  );

  // Process in batches
  const batches: BatchResult[] = [];
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let i = 0; i < typedRecipes.length; i += params.batchSize) {
    const batch = typedRecipes.slice(i, i + params.batchSize);
    const batchNum = Math.floor(i / params.batchSize) + 1;
    const batchResult: BatchResult = {
      batch: batchNum,
      processed: 0,
      skipped: 0,
      errors: 0,
      errorMessages: [],
    };

    console.log(
      `[backfill] Processing batch ${batchNum} (${batch.length} recipes)`,
    );

    for (const recipe of batch) {
      try {
        const embeddingText = buildEmbeddingText(recipe);
        const contentHash = await computeContentHash(embeddingText);

        // Skip if hash matches and not forcing regeneration
        if (
          !params.forceRegenerate &&
          existingHashMap.get(recipe.id) === contentHash
        ) {
          batchResult.skipped++;
          totalSkipped++;
          continue;
        }

        if (params.dryRun) {
          console.log(
            `[backfill] [DRY RUN] Would embed: ${recipe.name_en} (${recipe.id})`,
          );
          batchResult.processed++;
          totalProcessed++;
          continue;
        }

        // Generate embedding from the same text used for content hashing.
        const embedding = await generateEmbedding(embeddingText, openaiApiKey);

        // Upsert into recipe_embeddings
        const { error: upsertError } = await supabase
          .from("recipe_embeddings")
          .upsert(
            {
              recipe_id: recipe.id,
              embedding: JSON.stringify(embedding),
              embedding_model: EMBEDDING_MODEL,
              content_hash: contentHash,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "recipe_id" },
          );

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`);
        }

        batchResult.processed++;
        totalProcessed++;

        console.log(
          `[backfill] Embedded: ${recipe.name_en} (${recipe.id})`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        batchResult.errors++;
        batchResult.errorMessages.push(`${recipe.id}: ${msg}`);
        totalErrors++;
        console.error(
          `[backfill] Error for ${recipe.id} (${recipe.name_en}):`,
          msg,
        );
      }
    }

    batches.push(batchResult);
    console.log(
      `[backfill] Batch ${batchNum} complete:`,
      JSON.stringify({
        processed: batchResult.processed,
        skipped: batchResult.skipped,
        errors: batchResult.errors,
      }),
    );
  }

  // Run ANALYZE after backfill for query planner optimization
  if (!params.dryRun && totalProcessed > 0) {
    console.log(
      "[backfill] Post-run operator step required: ANALYZE public.recipe_embeddings;",
    );
  }

  return {
    totalRecipes: typedRecipes.length,
    totalProcessed,
    totalSkipped,
    totalErrors,
    batches,
  };
}

// ============================================================
// Edge Function Handler
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  // Verify service-role auth
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (
    !authHeader ||
    !serviceRoleKey ||
    authHeader !== `Bearer ${serviceRoleKey}`
  ) {
    return new Response(
      JSON.stringify({ error: "Service role authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Use defaults
    }

    const params: BackfillParams = {
      batchSize: Math.min(
        Math.max(Number(body.batchSize) || DEFAULT_BATCH_SIZE, 1),
        MAX_BATCH_SIZE,
      ),
      dryRun: body.dryRun === true,
      forceRegenerate: body.forceRegenerate === true,
    };

    console.log("[backfill] Starting with params:", JSON.stringify(params));
    const startTime = Date.now();

    const result = await runBackfill(params);

    const elapsed = Date.now() - startTime;
    console.log(
      `[backfill] Complete in ${elapsed}ms:`,
      JSON.stringify({
        totalRecipes: result.totalRecipes,
        totalProcessed: result.totalProcessed,
        totalSkipped: result.totalSkipped,
        totalErrors: result.totalErrors,
      }),
    );

    return new Response(
      JSON.stringify({
        ...result,
        durationMs: elapsed,
        dryRun: params.dryRun,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[backfill] Fatal error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
