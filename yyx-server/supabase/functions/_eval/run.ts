/**
 * AI Model Tournament — CLI Entry Point
 *
 * Usage:
 *   deno run --allow-net --allow-env --allow-read --allow-write run.ts [options]
 *
 * Options:
 *   --role <orchestrator|recipe_generation|recipe_modification>
 *   --model <model-id>
 *   --label <string>    Optional label for the run
 *   --dry-run           Print test matrix without making API calls
 */

import { parseArgs } from "https://deno.land/std@0.224.0/cli/parse_args.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { MODELS } from "./config.ts";
import {
  formatCost,
  formatDuration,
  getGitSha,
  loadApiKeys,
} from "./helpers.ts";
import { generateReport } from "./report.ts";
import type {
  EvalRole,
  ModelConfig,
  RunMetadata,
  TestCaseResult,
  TournamentResults,
} from "./types.ts";

// Test cases
import { CONVERSATION_TEST_CASES } from "./test-cases/conversation.ts";
import { RECIPE_GENERATION_TEST_CASES } from "./test-cases/recipe-generation.ts";
import { RECIPE_MODIFICATION_TEST_CASES } from "./test-cases/recipe-modification.ts";

// Runners
import { runConversationTests } from "./runners/conversation-runner.ts";
import { runRecipeTests } from "./runners/recipe-runner.ts";
import { runModificationTests } from "./runners/modification-runner.ts";

// ============================================================
// CLI Parsing
// ============================================================

const ALL_ROLES: EvalRole[] = [
  "orchestrator",
  "recipe_generation",
  "recipe_modification",
];

function parseCliArgs() {
  const args = parseArgs(Deno.args, {
    string: ["role", "model", "label"],
    boolean: ["dry-run", "help"],
    alias: { h: "help" },
  });

  if (args.help) {
    console.log(`
AI Model Tournament — Eval Framework

Usage:
  deno run --allow-net --allow-env --allow-read --allow-write run.ts [options]

Options:
  --role <role>     Filter by role: orchestrator, recipe_generation, recipe_modification
  --model <id>      Filter by model ID (e.g., gemini-2.5-flash, gpt-5-mini)
  --label <string>  Optional label for this run (appears in output dir name)
  --dry-run         Print test matrix and API key status without making calls
  --help            Show this help message
    `);
    Deno.exit(0);
  }

  const roles: EvalRole[] = args.role ? [args.role as EvalRole] : ALL_ROLES;

  const models: ModelConfig[] = args.model
    ? MODELS.filter((m) => m.id === args.model)
    : MODELS;

  if (args.model && models.length === 0) {
    console.error(`Unknown model: ${args.model}`);
    console.error(`Available: ${MODELS.map((m) => m.id).join(", ")}`);
    Deno.exit(1);
  }

  if (args.role && !ALL_ROLES.includes(args.role as EvalRole)) {
    console.error(`Unknown role: ${args.role}`);
    console.error(`Available: ${ALL_ROLES.join(", ")}`);
    Deno.exit(1);
  }

  return {
    roles,
    models,
    label: args.label as string | undefined,
    dryRun: args["dry-run"] as boolean,
  };
}

// ============================================================
// Dry Run
// ============================================================

function printDryRun(
  roles: EvalRole[],
  models: ModelConfig[],
  apiKeys: Record<string, string | undefined>,
) {
  console.log("\n=== DRY RUN — Test Matrix ===\n");

  // API key status
  console.log("API Key Status:");
  const keyEnvVars = [...new Set(models.map((m) => m.apiKeyEnvVar))];
  for (const envVar of keyEnvVars) {
    const status = apiKeys[envVar] ? "✅ Available" : "❌ Missing";
    console.log(`  ${envVar}: ${status}`);
  }
  console.log("");

  // Test matrix
  let totalCalls = 0;

  for (const role of roles) {
    const testCaseCount = role === "orchestrator"
      ? CONVERSATION_TEST_CASES.length
      : role === "recipe_generation"
      ? RECIPE_GENERATION_TEST_CASES.length
      : RECIPE_MODIFICATION_TEST_CASES.length;

    console.log(
      `${role.toUpperCase()} (${testCaseCount} test cases):`,
    );

    for (const model of models) {
      const apiKeyAvailable = !!apiKeys[model.apiKeyEnvVar];
      const status = apiKeyAvailable ? "✓" : "✗ (skip)";

      let calls = testCaseCount;

      // Multi-turn cases need 2 API calls each
      if (role === "orchestrator") {
        const multiTurnCount = CONVERSATION_TEST_CASES.filter(
          (tc) => tc.turns.length > 1,
        ).length;
        const singleTurnCount = testCaseCount - multiTurnCount;
        calls = singleTurnCount + multiTurnCount * 2;
      }

      // Reasoning variants for recipe generation
      let reasoningNote = "";
      if (
        role === "recipe_generation" &&
        model.capabilities.reasoning
      ) {
        calls *= 2; // low + medium
        reasoningNote = " (low + medium reasoning)";
      }

      if (apiKeyAvailable) totalCalls += calls;

      console.log(
        `  ${status} ${model.id} (${model.provider}) — ${calls} calls${reasoningNote}`,
      );
    }
    console.log("");
  }

  console.log(`Total API calls: ~${totalCalls}`);
  console.log("");
}

// ============================================================
// Main
// ============================================================

async function main() {
  const { roles, models, label, dryRun } = parseCliArgs();
  const apiKeys = loadApiKeys();

  if (dryRun) {
    printDryRun(roles, models, apiKeys);
    Deno.exit(0);
  }

  // Filter models with available API keys
  const availableModels = models.filter((m) => {
    const hasKey = !!apiKeys[m.apiKeyEnvVar];
    if (!hasKey) {
      console.warn(
        `⚠ Skipping ${m.id} — ${m.apiKeyEnvVar} not set`,
      );
    }
    return hasKey;
  });

  if (availableModels.length === 0) {
    console.error("No models available (all API keys missing)");
    Deno.exit(1);
  }

  // Collect metadata
  const metadata: RunMetadata = {
    timestamp: new Date().toISOString(),
    gitSha: await getGitSha(),
    denoVersion: Deno.version.deno,
    selectedRoles: roles,
    selectedModels: availableModels.map((m) => m.id),
    label,
  };

  console.log("\n=== AI Model Tournament ===");
  console.log(`Models: ${availableModels.map((m) => m.id).join(", ")}`);
  console.log(`Roles: ${roles.join(", ")}`);
  console.log(`Git SHA: ${metadata.gitSha}`);
  console.log("");

  const allResults: TestCaseResult[] = [];
  const overallStart = performance.now();

  // Run each role × model combination sequentially
  for (const role of roles) {
    console.log(`\n--- ${role.toUpperCase()} ---`);

    for (const model of availableModels) {
      const apiKey = apiKeys[model.apiKeyEnvVar]!;
      console.log(`\n[${role}] ${model.id} (${model.provider})`);

      let results: TestCaseResult[];

      switch (role) {
        case "orchestrator":
          results = await runConversationTests(
            model,
            CONVERSATION_TEST_CASES,
            apiKey,
          );
          break;
        case "recipe_generation":
          results = await runRecipeTests(
            model,
            RECIPE_GENERATION_TEST_CASES,
            apiKey,
          );
          break;
        case "recipe_modification":
          results = await runModificationTests(
            model,
            RECIPE_MODIFICATION_TEST_CASES,
            apiKey,
          );
          break;
      }

      allResults.push(...results);
    }
  }

  const totalTime = Math.round(performance.now() - overallStart);
  console.log(`\n=== Done in ${formatDuration(totalTime)} ===`);

  // Calculate total cost
  const totalCost = allResults.reduce((sum, r) => sum + r.costUsd, 0);
  console.log(`Total cost: ${formatCost(totalCost)}`);

  // Generate output
  const tournament: TournamentResults = {
    metadata,
    results: allResults,
  };

  // Create output directory
  const now = new Date();
  const datePart = now.toISOString().slice(0, 16).replace("T", "_").replace(
    ":",
    "-",
  );
  const dirName = label ? `${datePart}-${label}` : datePart;
  const outputDir = new URL(`./output/${dirName}/`, import.meta.url).pathname;
  await ensureDir(outputDir);

  // Write results
  const resultsPath = `${outputDir}results.json`;
  const reportPath = `${outputDir}report.md`;

  await Deno.writeTextFile(
    resultsPath,
    JSON.stringify(tournament, null, 2),
  );

  const report = generateReport(tournament);
  await Deno.writeTextFile(reportPath, report);

  console.log(`\nResults: ${resultsPath}`);
  console.log(`Report:  ${reportPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  Deno.exit(1);
});
