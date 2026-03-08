/**
 * AI Model Tournament — Report Generator
 *
 * Generates markdown reports with summary tables, detailed results,
 * and a judge-ready section for Claude Code quality scoring.
 */

import { formatCost, formatDuration } from "./helpers.ts";
import type { EvalRole, TestCaseResult, TournamentResults } from "./types.ts";

// ============================================================
// Report Generator
// ============================================================

export function generateReport(tournament: TournamentResults): string {
  const sections: string[] = [];

  // Header
  sections.push(`# AI Model Tournament Report`);
  sections.push("");
  sections.push(`**Date:** ${tournament.metadata.timestamp}`);
  sections.push(`**Git SHA:** ${tournament.metadata.gitSha}`);
  sections.push(`**Deno:** ${tournament.metadata.denoVersion}`);
  if (tournament.metadata.label) {
    sections.push(`**Label:** ${tournament.metadata.label}`);
  }
  sections.push(
    `**Roles:** ${tournament.metadata.selectedRoles.join(", ")}`,
  );
  sections.push(
    `**Models:** ${tournament.metadata.selectedModels.join(", ")}`,
  );
  sections.push("");
  sections.push("---");
  sections.push("");

  // Group results by role
  const roles = [...new Set(tournament.results.map((r) => r.role))];

  for (const role of roles) {
    const roleResults = tournament.results.filter((r) => r.role === role);
    sections.push(generateRoleSection(role, roleResults));
  }

  // Judge-ready section
  sections.push(generateJudgeSection(tournament.results));

  return sections.join("\n");
}

// ============================================================
// Role Summary
// ============================================================

function generateRoleSection(
  role: EvalRole,
  results: TestCaseResult[],
): string {
  const lines: string[] = [];
  const roleTitle = role.replace(/_/g, " ").replace(
    /\b\w/g,
    (c) => c.toUpperCase(),
  );

  lines.push(`## ${roleTitle}`);
  lines.push("");

  // Summary table
  lines.push(generateSummaryTable(role, results));
  lines.push("");

  // Detailed results per test case
  lines.push(generateDetailedResults(role, results));
  lines.push("");
  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

function generateSummaryTable(
  role: EvalRole,
  results: TestCaseResult[],
): string {
  const lines: string[] = [];

  // Group by modelId
  const models = [...new Set(results.map((r) => r.modelId))];

  // Role-specific columns
  const isOrchestrator = role === "orchestrator";
  const isRecipe = role === "recipe_generation" ||
    role === "recipe_modification";

  // Header
  if (isOrchestrator) {
    lines.push(
      "| Model | Reasoning | Eval Method | Avg Latency | Avg Cost | Success Rate | Tool Accuracy | Retries |",
    );
    lines.push(
      "|-------|-----------|-------------|-------------|----------|-------------|--------------|---------|",
    );
  } else {
    lines.push(
      "| Model | Reasoning | Avg Latency | Avg Cost | Success Rate | Schema Valid% | Thermomix% | Retries |",
    );
    lines.push(
      "|-------|-----------|-------------|----------|-------------|--------------|------------|---------|",
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

    if (isOrchestrator) {
      const evalMethod = modelResults[0].evaluationMethod ?? "tool_call";
      const toolCorrectCount = modelResults.filter(
        (r) => r.toolCorrect,
      ).length;
      const toolAccuracy = (
        (toolCorrectCount / modelResults.length) *
        100
      ).toFixed(0);

      const evalLabel = evalMethod === "intent_analysis" ? "intent" : "tool";

      lines.push(
        `| ${modelId} | ${reasoning} | ${evalLabel} | ${
          formatDuration(avgLatency)
        } | ${formatCost(avgCost)} | ${
          successRate.toFixed(0)
        }% | ${toolAccuracy}% | ${totalRetries} |`,
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

      lines.push(
        `| ${modelId} | ${reasoning} | ${formatDuration(avgLatency)} | ${
          formatCost(avgCost)
        } | ${
          successRate.toFixed(0)
        }% | ${schemaValid}% | ${thermomix}% | ${totalRetries} |`,
      );
    }
  }

  return lines.join("\n");
}

// ============================================================
// Detailed Results
// ============================================================

function generateDetailedResults(
  role: EvalRole,
  results: TestCaseResult[],
): string {
  const lines: string[] = [];

  // Group by test case
  const testCaseIds = [...new Set(results.map((r) => r.testCaseId))];

  for (const testCaseId of testCaseIds) {
    const caseResults = results.filter((r) => r.testCaseId === testCaseId);
    const firstResult = caseResults[0];

    lines.push(`### ${testCaseId}`);
    lines.push("");
    lines.push(`**${firstResult.testCaseDescription}**`);
    if (firstResult.expectedTool !== undefined) {
      lines.push(
        `**Expected tool:** ${firstResult.expectedTool ?? "none (chat)"}`,
      );
    }
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

      lines.push(
        `**${result.modelId}** ${statusIcon} | ${
          formatDuration(result.latencyMs)
        } | ${formatCost(result.costUsd)}${retryNote}`,
      );

      // Role-specific details
      if (role === "orchestrator") {
        const method = result.evaluationMethod === "intent_analysis"
          ? " (intent)"
          : "";
        lines.push(
          `- Tool called: ${result.toolCalled ?? "none"}${method}`,
        );
        if (result.turns && result.turns > 1) {
          lines.push(`- Turns: ${result.turns}`);
        }
      } else {
        lines.push(
          `- JSON valid: ${result.jsonValid ? "✅" : "❌"} | Schema valid: ${
            result.schemaValid ? "✅" : "❌"
          } | Thermomix: ${result.thermomixPresent ? "✅" : "❌"}`,
        );
      }

      if (result.error) {
        lines.push(`- Error: ${result.error}`);
      }

      // Full output in details
      lines.push(
        `<details><summary>Full output</summary>\n\n\`\`\`\n${
          truncate(result.responseContent, 3000)
        }\n\`\`\`\n</details>`,
      );
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

  lines.push("## Judge-Ready Section");
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
    const roleTitle = role.replace(/_/g, " ").replace(
      /\b\w/g,
      (c) => c.toUpperCase(),
    );

    lines.push(`### ${roleTitle}`);
    lines.push("");

    const testCaseIds = [...new Set(roleResults.map((r) => r.testCaseId))];

    for (const testCaseId of testCaseIds) {
      const caseResults = roleResults.filter(
        (r) => r.testCaseId === testCaseId && r.status !== "skipped",
      );
      if (caseResults.length === 0) continue;

      lines.push(`#### ${testCaseId}: ${caseResults[0].testCaseDescription}`);
      lines.push("");

      for (const result of caseResults) {
        lines.push(`**${result.modelId}:**`);
        lines.push("```");
        lines.push(truncate(result.responseContent, 2000));
        lines.push("```");
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

// ============================================================
// Helpers
// ============================================================

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n... [truncated]";
}
