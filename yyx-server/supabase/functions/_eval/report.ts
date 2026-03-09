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
      "| Model | Reasoning | Avg Latency | tok/s | Avg Cost | Success Rate | Tool Accuracy | Retries |",
    );
    lines.push(
      "|-------|-----------|-------------|-------|----------|-------------|--------------|---------|",
    );
  } else {
    lines.push(
      "| Model | Reasoning | Schema | Avg Latency | tok/s | Avg Cost | Pass Rate | Schema Valid% | TMX% | Retries |",
    );
    lines.push(
      "|-------|-----------|--------|-------------|-------|----------|-----------|--------------|------|---------|",
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

      // Schema enforcement indicator
      const schemaEnforced = modelResults[0].schemaEnforced;
      const schemaCol = schemaEnforced === true
        ? "yes"
        : schemaEnforced === false
        ? "no"
        : "—";

      lines.push(
        `| ${modelId} | ${reasoning} | ${schemaCol} | ${
          formatDuration(avgLatency)
        } | ${tokSecStr} | ${formatCost(avgCost)} | ${
          successRate.toFixed(0)
        }% | ${schemaValid}% | ${thermomix}% | ${totalRetries} |`,
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
  const lines: string[] = [];
  const testCaseIds = [...new Set(results.map((r) => r.testCaseId))];

  for (const testCaseId of testCaseIds) {
    const caseResults = results.filter((r) => r.testCaseId === testCaseId);
    const firstResult = caseResults[0];

    const expectedInfo = firstResult.expectedTool !== undefined
      ? ` | Expected: \`${firstResult.expectedTool ?? "none (chat)"}\``
      : "";
    lines.push(
      `### ${testCaseId}: ${firstResult.testCaseDescription}${expectedInfo}`,
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
      ];

      if (result.outputTokensPerSec && result.outputTokensPerSec > 0) {
        metricsParts.push(`${result.outputTokensPerSec} tok/s`);
      }

      if (role === "orchestrator") {
        metricsParts.push(
          `tool: \`${result.toolCalled ?? "none"}\``,
        );
      } else {
        const checks = [
          result.jsonValid ? "json:✅" : "json:❌",
          result.schemaValid ? "schema:✅" : "schema:❌",
          result.thermomixPresent ? "tmx:✅" : "tmx:❌",
        ].join(" ");
        metricsParts.push(checks);
        if (result.schemaEnforced === false) {
          metricsParts.push("(no-schema)");
        }
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
        const content = truncate(result.responseContent, 3000);
        const isJson = content.trimStart().startsWith("{") ||
          content.trimStart().startsWith("[");
        const lang = isJson ? "json" : "";

        let displayContent = content;
        if (isJson) {
          try {
            displayContent = JSON.stringify(JSON.parse(content), null, 2);
          } catch {
            // Keep original
          }
        }

        lines.push(
          `<details><summary>Full output</summary>\n\n\`\`\`${lang}\n${
            truncate(displayContent, 4000)
          }\n\`\`\`\n</details>`,
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

      for (const result of caseResults) {
        const content = truncate(result.responseContent, 2000);
        const isJson = content.trimStart().startsWith("{") ||
          content.trimStart().startsWith("[");
        const lang = isJson ? "json" : "";

        let displayContent = content;
        if (isJson) {
          try {
            displayContent = JSON.stringify(JSON.parse(content), null, 2);
          } catch {
            // Keep original
          }
        }

        lines.push(`**${result.modelId}:**`);
        lines.push(`\`\`\`${lang}`);
        lines.push(truncate(displayContent, 2000));
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

function formatRoleTitle(role: EvalRole): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n... [truncated]";
}
