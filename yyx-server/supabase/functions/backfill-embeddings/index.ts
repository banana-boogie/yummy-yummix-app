/**
 * Backfill Embeddings Edge Function
 *
 * Generates vector embeddings for published recipes using the AI Gateway embedding route.
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
import { embed, getProviderConfig } from "../_shared/ai-gateway/index.ts";
import {
  createServiceClient,
  getSupabaseUrl,
} from "../_shared/supabase-client.ts";
import type { RecipeEmbeddingRow } from "../_shared/recipe-query-types.ts";
import {
  buildEmbeddingText,
  computeContentHash,
  getEmbeddingModel,
} from "./embedding-utils.ts";

// ============================================================
// Types
// ============================================================

interface BackfillParams {
  batchSize: number;
  dryRun: boolean;
  forceRegenerate: boolean;
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

// ============================================================
// AI Gateway Embedding API
// ============================================================

/**
 * Generate embedding via AI Gateway with retry.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await embed({ usageType: "embedding", text });
      return response.embedding;
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
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const embeddingProviderConfig = getProviderConfig("embedding");
  const embeddingApiKey = Deno.env.get(embeddingProviderConfig.apiKeyEnvVar);
  const embeddingModel = getEmbeddingModel();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!embeddingApiKey) {
    throw new Error(`Missing ${embeddingProviderConfig.apiKeyEnvVar}`);
  }

  const supabase = createServiceClient();

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

  const typedRecipes = recipes as unknown as RecipeEmbeddingRow[];
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
        const contentHash = await computeContentHash(
          embeddingText,
          embeddingModel,
        );

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
        const embedding = await generateEmbedding(embeddingText);

        // Upsert into recipe_embeddings
        const { error: upsertError } = await supabase
          .from("recipe_embeddings")
          .upsert(
            {
              recipe_id: recipe.id,
              embedding: JSON.stringify(embedding),
              embedding_model: embeddingModel,
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
