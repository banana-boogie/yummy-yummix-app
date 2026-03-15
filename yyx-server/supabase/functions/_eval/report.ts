/**
 * AI Model Tournament — Report Generator
 *
 * Generates markdown reports with summary tables, detailed results,
 * and a judge-ready section for Claude Code quality scoring.
 */

import { formatCost, formatDuration } from "./helpers.ts";
import type { EvalRole, TestCaseResult, TournamentResults } from "./types.ts";
import { CONVERSATION_TEST_CASES } from "./test-cases/conversation.ts";

// ============================================================
// Report Generator
// ============================================================

export function generateReport(tournament: TournamentResults): string {
  const sections: string[] = [];

  // Header
  const date = new Date(tournament.metadata.timestamp);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const totalCost = tournament.results.reduce((sum, r) => sum + r.costUsd, 0);

  sections.push("# AI Model Tournament Report");
  sections.push("");
  sections.push(`- **Date:** ${formattedDate}`);
  sections.push(`- **Git SHA:** ${tournament.metadata.gitSha}`);
  sections.push(`- **Deno:** ${tournament.metadata.denoVersion}`);
  if (tournament.metadata.label) {
    sections.push(`- **Label:** ${tournament.metadata.label}`);
  }
  sections.push(
    `- **Roles:** ${tournament.metadata.selectedRoles.join(", ")}`,
  );
  sections.push(
    `- **Models:** ${tournament.metadata.selectedModels.join(", ")}`,
  );
  sections.push(`- **Total cost:** ${formatCost(totalCost)}`);
  sections.push("");
  sections.push("---");
  sections.push("");

  // ---- ALL SUMMARIES FIRST ----
  const roles = [...new Set(tournament.results.map((r) => r.role))];

  for (const role of roles) {
    const roleResults = tournament.results.filter((r) => r.role === role);
    const roleTitle = formatRoleTitle(role);
    sections.push(`## ${roleTitle} — Summary`);
    sections.push("");
    sections.push(generateSummaryTable(role, roleResults));
    sections.push("");
  }

  // Schema comparison (if we have schema vs no-schema data)
  const schemaComparison = generateSchemaComparison(tournament.results);
  if (schemaComparison) {
    sections.push(schemaComparison);
  }

  sections.push("---");
  sections.push("");

  // ---- DETAILED RESULTS ----
  sections.push("# Detailed Results");
  sections.push("");

  for (const role of roles) {
    const roleResults = tournament.results.filter((r) => r.role === role);
    const roleTitle = formatRoleTitle(role);
    sections.push(`## ${roleTitle} — Details`);
    sections.push("");
    sections.push(generateDetailedResults(role, roleResults));
    sections.push("");
    sections.push("---");
    sections.push("");
  }

  // Judge-ready section
  sections.push(generateJudgeSection(tournament.results));

  return sections.join("\n");
}

// ============================================================
// Summary Table
// ============================================================

function generateSummaryTable(
  role: EvalRole,
  results: TestCaseResult[],
): string {
  const lines: string[] = [];
  const models = [...new Set(results.map((r) => r.modelId))];
  const isOrchestrator = role === "orchestrator";

  if (isOrchestrator) {
    lines.push(
      "| Model | Reasoning | Avg Latency | tok/s | Avg Cost | Total Cost | Success Rate | Tool Accuracy | Retries |",
    );
    lines.push(
      "|-------|-----------|-------------|-------|----------|------------|-------------|--------------|---------|",
    );
  } else {
    lines.push(
      "| Model | Reasoning | Schema | Avg Latency | tok/s | Avg Cost | Total Cost | Pass Rate | Schema Valid% | TMX% | Items | Retries |",
    );
    lines.push(
      "|-------|-----------|--------|-------------|-------|----------|------------|-----------|--------------|------|-------|---------|",
    );
  }

  for (const modelId of models) {
    const modelResults = results.filter(
      (r) => r.modelId === modelId && r.status !== "skipped",
    );
    if (modelResults.length === 0) continue;

    const avgLatency = modelResults.reduce((sum, r) => sum + r.latencyMs, 0) /
      modelResults.length;
    const avgCost = modelResults.reduce((sum, r) => sum + r.costUsd, 0) /
      modelResults.length;
    const successRate = (modelResults.filter((r) =>
      r.status === "pass"
    ).length /
      modelResults.length) *
      100;
    const totalRetries = modelResults.reduce(
      (sum, r) => sum + Math.max(0, r.attempts.length - 1),
      0,
    );
    const reasoning = modelResults[0].reasoningEffort ?? "—";

    // Average tok/s (only from successful calls with data)
    const tokSecResults = modelResults.filter(
      (r) => r.outputTokensPerSec && r.outputTokensPerSec > 0,
    );
    const avgTokSec = tokSecResults.length > 0
      ? Math.round(
        tokSecResults.reduce((sum, r) => sum + (r.outputTokensPerSec ?? 0), 0) /
          tokSecResults.length,
      )
      : 0;
    const tokSecStr = avgTokSec > 0 ? `${avgTokSec}` : "—";

    const totalCost = modelResults.reduce((sum, r) => sum + r.costUsd, 0);

    if (isOrchestrator) {
      const toolCorrectCount = modelResults.filter(
        (r) => r.toolCorrect,
      ).length;
      const toolAccuracy = (
        (toolCorrectCount / modelResults.length) *
        100
      ).toFixed(0);

      lines.push(
        `| ${modelId} | ${reasoning} | ${
          formatDuration(avgLatency)
        } | ${tokSecStr} | ${formatCost(avgCost)} | ${
          formatCost(totalCost)
        } | ${successRate.toFixed(0)}% | ${toolAccuracy}% | ${totalRetries} |`,
      );
    } else {
      const schemaValidCount = modelResults.filter(
        (r) => r.schemaValid,
      ).length;
      const schemaValid = (
        (schemaValidCount / modelResults.length) *
        100
      ).toFixed(0);
      const thermomixCount = modelResults.filter(
        (r) => r.thermomixPresent,
      ).length;
      const thermomix = (
        (thermomixCount / modelResults.length) *
        100
      ).toFixed(0);

      // Schema enforcement indicator
      const schemaEnforced = modelResults[0].schemaEnforced;
      const schemaCol = schemaEnforced === true
        ? "yes"
        : schemaEnforced === false
        ? "no"
        : "—";

      // Kitchen tools metrics
      const itemsResults = modelResults.filter(
        (r) => r.kitchenToolsCount != null && r.kitchenToolsCount > 0,
      );
      const avgItems = itemsResults.length > 0
        ? (
          itemsResults.reduce(
            (sum, r) => sum + (r.kitchenToolsCount ?? 0),
            0,
          ) / itemsResults.length
        ).toFixed(1)
        : "0";

      lines.push(
        `| ${modelId} | ${reasoning} | ${schemaCol} | ${
          formatDuration(avgLatency)
        } | ${tokSecStr} | ${formatCost(avgCost)} | ${
          formatCost(totalCost)
        } | ${
          successRate.toFixed(0)
        }% | ${schemaValid}% | ${thermomix}% | ${avgItems} | ${totalRetries} |`,
      );
    }
  }

  return lines.join("\n");
}

// ============================================================
// Schema Comparison
// ============================================================

function generateSchemaComparison(results: TestCaseResult[]): string | null {
  // Find models that have both schema and no-schema results
  const recipeResults = results.filter(
    (r) => r.role === "recipe_generation" && r.schemaEnforced !== undefined,
  );
  if (recipeResults.length === 0) return null;

  const withSchema = recipeResults.filter((r) => r.schemaEnforced === true);
  const withoutSchema = recipeResults.filter((r) => r.schemaEnforced === false);
  if (withoutSchema.length === 0) return null;

  const lines: string[] = [];
  lines.push("## Schema vs No-Schema Comparison");
  lines.push("");
  lines.push(
    "Does JSON schema enforcement (`responseFormat`) slow down generation?",
  );
  lines.push("");
  lines.push(
    "| Model | Reasoning | Schema | Avg Latency | tok/s | Pass Rate | Schema Valid% |",
  );
  lines.push(
    "|-------|-----------|--------|-------------|-------|-----------|--------------|",
  );

  // Group by base model + reasoning effort
  const groups = new Map<string, TestCaseResult[]>();
  for (const r of recipeResults) {
    // Extract base model name (strip schema label)
    const baseModel = r.modelId
      .replace(/, no-schema/, "")
      .replace(/ \(no-schema\)/, "");
    const key = `${baseModel}|${
      r.reasoningEffort ?? "none"
    }|${r.schemaEnforced}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  // Sort by model name then schema (yes first, no second)
  const sortedKeys = [...groups.keys()].sort();

  for (const key of sortedKeys) {
    const groupResults = groups.get(key)!;
    const first = groupResults[0];
    const avgLatency = groupResults.reduce((sum, r) => sum + r.latencyMs, 0) /
      groupResults.length;
    const passRate = (groupResults.filter((r) => r.status === "pass").length /
      groupResults.length) *
      100;
    const schemaValidRate = (groupResults.filter((r) => r.schemaValid).length /
      groupResults.length) *
      100;

    const tokSecResults = groupResults.filter(
      (r) => r.outputTokensPerSec && r.outputTokensPerSec > 0,
    );
    const avgTokSec = tokSecResults.length > 0
      ? Math.round(
        tokSecResults.reduce((sum, r) => sum + (r.outputTokensPerSec ?? 0), 0) /
          tokSecResults.length,
      )
      : 0;

    const reasoning = first.reasoningEffort ?? "—";
    const schemaCol = first.schemaEnforced ? "yes" : "**no**";

    lines.push(
      `| ${first.modelId} | ${reasoning} | ${schemaCol} | ${
        formatDuration(avgLatency)
      } | ${avgTokSec > 0 ? avgTokSec : "—"} | ${passRate.toFixed(0)}% | ${
        schemaValidRate.toFixed(0)
      }% |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

// ============================================================
// Detailed Results
// ============================================================

function generateDetailedResults(
  role: EvalRole,
  results: TestCaseResult[],
): string {
  if (role === "orchestrator") {
    return generateOrchestratorChatResults(results);
  }
  return generateRecipeDetailedResults(role, results);
}

/**
 * Format orchestrator results as chat conversations.
 * Shows "You:" with the user message and "Irmixy (model):" with the response.
 */
function generateOrchestratorChatResults(results: TestCaseResult[]): string {
  const lines: string[] = [];
  const testCaseIds = [...new Set(results.map((r) => r.testCaseId))];

  // Build lookup from test case IDs to user messages
  const testCaseLookup = new Map<
    string,
    {
      turns: Array<
        {
          userMessage: string;
          expectedTool: string | null;
          expectedBehavior: string;
        }
      >;
    }
  >();
  for (const tc of CONVERSATION_TEST_CASES) {
    testCaseLookup.set(tc.id, { turns: tc.turns });
  }

  for (const testCaseId of testCaseIds) {
    const caseResults = results.filter((r) => r.testCaseId === testCaseId);
    const firstResult = caseResults[0];
    const testCase = testCaseLookup.get(testCaseId);
    const isMultiTurn = testCase && testCase.turns.length > 1;

    // Test case header
    lines.push(`### ${testCaseId}: ${firstResult.testCaseDescription}`);
    lines.push("");

    if (testCase) {
      if (isMultiTurn) {
        // Multi-turn: show all turns with expected behavior
        for (let i = 0; i < testCase.turns.length; i++) {
          const turn = testCase.turns[i];
          const turnLabel = i === 0 ? "You" : "You (follow-up)";
          lines.push(`> **${turnLabel}:** ${turn.userMessage}`);
          lines.push(">");
          lines.push(
            `> *Expected: ${
              turn.expectedTool
                ? `Call \`${turn.expectedTool}\``
                : "Chat — do NOT call a tool"
            }. ${turn.expectedBehavior}*`,
          );
          if (i < testCase.turns.length - 1) lines.push("");
        }
      } else {
        // Single turn: show user message and expected behavior
        const turn = testCase.turns[0];
        lines.push(`> **You:** ${turn.userMessage}`);
        lines.push(">");
        lines.push(
          `> *Expected: ${
            turn.expectedTool
              ? `Call \`${turn.expectedTool}\``
              : "Chat — do NOT call a tool"
          }*`,
        );
      }
    }
    lines.push("");

    // Each model's response
    for (const result of caseResults) {
      const statusIcon = result.status === "pass" ? "✅" : "❌";
      const retryNote = result.attempts.length > 1
        ? ` (${result.attempts.length} attempts)`
        : "";

      const toolInfo = result.toolCalled
        ? `called \`${result.toolCalled}\``
        : "no tool";

      lines.push(
        `**Irmixy (${result.modelId})** ${statusIcon} ${
          formatDuration(result.latencyMs)
        } | ${toolInfo}${retryNote}`,
      );

      if (result.error) {
        lines.push(`> ERROR: ${result.error}`);
      } else {
        const content = result.responseContent.trim();
        if (content) {
          // Indent response as a blockquote for chat feel
          const quotedContent = content
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n");
          lines.push(quotedContent);
        }
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format recipe generation/modification results with recipe cards.
 */
function generateRecipeDetailedResults(
  role: EvalRole,
  results: TestCaseResult[],
): string {
  const lines: string[] = [];
  const testCaseIds = [...new Set(results.map((r) => r.testCaseId))];

  for (const testCaseId of testCaseIds) {
    const caseResults = results.filter((r) => r.testCaseId === testCaseId);
    const firstResult = caseResults[0];

    lines.push(
      `### ${testCaseId}: ${firstResult.testCaseDescription}`,
    );
    lines.push("");

    for (const result of caseResults) {
      const statusIcon = result.status === "pass"
        ? "✅"
        : result.status === "fail"
        ? "❌"
        : "⏭️";
      const retryNote = result.attempts.length > 1
        ? ` (${result.attempts.length} attempts)`
        : "";

      const metricsParts = [
        formatDuration(result.latencyMs),
        formatCost(result.costUsd),
        `${result.inputTokens}→${result.outputTokens} tok`,
      ];

      if (result.outputTokensPerSec && result.outputTokensPerSec > 0) {
        metricsParts.push(`${result.outputTokensPerSec} tok/s`);
      }

      const checks = [
        result.jsonValid ? "json:✅" : "json:❌",
        result.schemaValid ? "schema:✅" : "schema:❌",
        result.thermomixPresent ? "tmx:✅" : "tmx:❌",
        `items:${result.kitchenToolsCount ?? 0}`,
      ].join(" ");
      metricsParts.push(checks);
      if (result.schemaEnforced === false) {
        metricsParts.push("(no-schema)");
      }

      lines.push(
        `**${result.modelId}** ${statusIcon} ${
          metricsParts.join(" | ")
        }${retryNote}`,
      );

      if (result.error) {
        lines.push(`> Error: ${result.error}`);
      }

      if (!result.error) {
        const formatted = formatRecipeForReport(result.responseContent);
        lines.push(
          `<details><summary>Recipe output</summary>\n\n${formatted}\n</details>`,
        );
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ============================================================
// Judge-Ready Section
// ============================================================

function generateJudgeSection(results: TestCaseResult[]): string {
  const lines: string[] = [];

  lines.push("# Judge-Ready Section");
  lines.push("");
  lines.push(
    "> Copy-paste the blocks below into Claude Code for quality scoring.",
  );
  lines.push(
    "> Each block contains the prompt + model output for a single test case.",
  );
  lines.push("");

  const roles = [...new Set(results.map((r) => r.role))];

  for (const role of roles) {
    const roleResults = results.filter((r) => r.role === role);
    const roleTitle = formatRoleTitle(role);

    lines.push(`## ${roleTitle}`);
    lines.push("");

    const testCaseIds = [...new Set(roleResults.map((r) => r.testCaseId))];

    for (const testCaseId of testCaseIds) {
      const caseResults = roleResults.filter(
        (r) => r.testCaseId === testCaseId && r.status !== "skipped",
      );
      if (caseResults.length === 0) continue;

      lines.push(
        `### ${testCaseId}: ${caseResults[0].testCaseDescription}`,
      );
      lines.push("");

      // For orchestrator, show user message first
      if (role === "orchestrator") {
        const testCase = CONVERSATION_TEST_CASES.find(
          (tc) => tc.id === testCaseId,
        );
        if (testCase) {
          for (let i = 0; i < testCase.turns.length; i++) {
            const turn = testCase.turns[i];
            const label = i === 0 ? "You" : "You (follow-up)";
            lines.push(`> **${label}:** ${turn.userMessage}`);
          }
          lines.push("");
        }
      }

      for (const result of caseResults) {
        const isRecipeRole = role === "recipe_generation" ||
          role === "recipe_modification";

        if (role === "orchestrator") {
          const toolInfo = result.toolCalled
            ? ` | called \`${result.toolCalled}\``
            : "";
          lines.push(`**Irmixy (${result.modelId}):**${toolInfo}`);
          lines.push(truncate(result.responseContent, 2000));
        } else {
          lines.push(`**${result.modelId}:**`);
          lines.push(formatRecipeForReport(result.responseContent));
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

// ============================================================
// Helpers
// ============================================================

function formatRoleTitle(role: EvalRole): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n... [truncated]";
}

/**
 * Format a recipe JSON response as a human-readable recipe card.
 * Falls back to pretty-printed JSON if parsing fails.
 */
function formatRecipeForReport(content: string): string {
  try {
    let jsonContent = content.trim();
    if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }

    const recipe = JSON.parse(jsonContent);
    const lines: string[] = [];

    // Header
    lines.push(`#### ${recipe.suggestedName || "Untitled Recipe"}`);
    if (recipe.description) {
      lines.push(`*${recipe.description}*`);
    }
    lines.push("");
    lines.push(
      `**${recipe.portions || "?"} portions** | **${
        recipe.totalTime || "?"
      } min** | **${recipe.difficulty || "?"}** | **${
        recipe.language || "?"
      }** | **${recipe.measurementSystem || "?"}**`,
    );
    lines.push("");

    // Ingredients
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      lines.push("**Ingredients:**");
      for (const ing of recipe.ingredients) {
        lines.push(`- ${ing.quantity} ${ing.unit} ${ing.name}`);
      }
      lines.push("");
    }

    // Steps
    if (recipe.steps && recipe.steps.length > 0) {
      lines.push("**Steps:**");
      for (const step of recipe.steps) {
        let stepLine = `${step.order}. ${step.instruction}`;

        // Thermomix params
        const hasTmx = step.thermomixTime != null ||
          step.thermomixTemp != null || step.thermomixSpeed != null;
        if (hasTmx) {
          const tmxParts: string[] = [];
          if (step.thermomixTime != null) {
            const mins = Math.floor(step.thermomixTime / 60);
            const secs = step.thermomixTime % 60;
            tmxParts.push(
              mins > 0 ? `${mins}m${secs > 0 ? `${secs}s` : ""}` : `${secs}s`,
            );
          }
          if (step.thermomixTemp != null) tmxParts.push(step.thermomixTemp);
          if (step.thermomixSpeed != null) {
            tmxParts.push(`Speed ${step.thermomixSpeed}`);
          }
          stepLine += ` **[TMX: ${tmxParts.join(" / ")}]**`;
        }

        if (step.ingredientsUsed && step.ingredientsUsed.length > 0) {
          stepLine += ` *(${step.ingredientsUsed.join(", ")})*`;
        }
        lines.push(stepLine);
      }
      lines.push("");
    }

    // Kitchen Tools
    if (recipe.kitchenTools && recipe.kitchenTools.length > 0) {
      lines.push("**Kitchen Tools:**");
      for (const item of recipe.kitchenTools) {
        const note = item.notes ? ` — ${item.notes}` : "";
        lines.push(`- ${item.name}${note}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  } catch {
    // Fallback to pretty JSON
    try {
      return "```json\n" + JSON.stringify(JSON.parse(content), null, 2) +
        "\n```";
    } catch {
      return "```\n" + truncate(content, 3000) + "\n```";
    }
  }
}
