<script setup lang="ts">
import { ChevronDown, GitBranch, Wrench } from "lucide-vue-next";
import { computed } from "vue";

import type {
  AiopsDiagnosticEvidenceChain,
  AiopsDiagnosticStep,
  ToolCallAudit
} from "@agent-py/api-contracts";

import AsyncStatusBadge from "./AsyncStatusBadge.vue";
import UserFeedbackControl from "./UserFeedbackControl.vue";

const props = defineProps<{ readonly chain: AiopsDiagnosticEvidenceChain | null }>();
const visiblePhases = new Set(["planner", "executor", "replanner"]);

const executionSteps = computed(() =>
  [...(props.chain?.steps ?? [])]
    .filter((step) => visiblePhases.has(step.phase.toLowerCase()))
    .sort((left, right) => left.sequence - right.sequence)
);

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stepTitle(step: AiopsDiagnosticStep): string {
  const payload = record(step.payload);
  if (step.phase === "planner") {
    const plan = Array.isArray(payload.plan) ? payload.plan : [];
    return `Planner · generated ${plan.length || 1} diagnostic step${(plan.length || 1) === 1 ? '' : 's'}`;
  }
  if (step.phase === "executor") {
    const planStep = record(payload.planStep);
    const purpose = typeof planStep.purpose === "string" ? planStep.purpose : "Run the diagnostic step";
    return `Executor · ${purpose}`;
  }
  const decision = payload.decision === "executor" ? "adjust the plan and continue" : "evidence is complete; move to the report";
  return `Replanner · ${decision}`;
}

function stepOutput(step: AiopsDiagnosticStep): readonly string[] {
  const payload = record(step.payload);
  if (step.phase === "planner") {
    const plan = Array.isArray(payload.plan) ? payload.plan.map(record) : [];
    const lines = plan.slice(0, 5).map((item, index) => {
      const purpose = typeof item.purpose === "string" ? item.purpose : "Collect diagnostic evidence";
      const tool = typeof item.tool === "string" ? item.tool : "unspecified tool";
      return `${index + 1}. ${purpose} (${tool})`;
    });
    const evidenceLine = payload.noSopMatched === true
      ? "No SOP matched, so the plan fell back to the general diagnostic flow."
      : "The plan used an accessible SOP or historical case.";
    return [evidenceLine, ...lines];
  }
  if (step.phase === "executor") {
    const tool = typeof payload.tool === "string" ? payload.tool : "unspecified tool";
    return [`Called ${tool} to collect live data.`, `Status: ${step.status}`];
  }
  const planIndex = typeof payload.planIndex === "number" ? payload.planIndex : 0;
  const planLength = typeof payload.planLength === "number" ? payload.planLength : 0;
  return [
    `Plan progress: ${planIndex}/${planLength}`,
    payload.executionFailed === true ? "Execution failed, so later steps were stopped." : "The next decision was made from the results so far."
  ];
}

function parseSummary(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function readableLog(recordValue: unknown): string | null {
  const value = record(recordValue);
  const parts: string[] = [];
  for (const key of ["timestamp", "level", "service", "event", "message", "latency_ms"]) {
    const item = value[key];
    if (typeof item === "string" || typeof item === "number") parts.push(String(item));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function legacySearchLogRecords(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) return [];
  for (const item of value) {
    const text = record(item).text;
    if (typeof text !== "string") continue;
    try {
      const logs = JSON.parse(text) as unknown;
      if (!Array.isArray(logs)) continue;
      return logs.map((log) => {
        const rawLog = record(log).LogJson;
        if (typeof rawLog !== "string") return log;
        try {
          return JSON.parse(rawLog) as unknown;
        } catch {
          return {};
        }
      });
    } catch {
      return [];
    }
  }
  return [];
}

function searchLogLines(parsed: unknown): readonly string[] | null {
  const parsedRecord = record(parsed);
  const directRecords = Array.isArray(parsedRecord.records) ? parsedRecord.records : [];
  const records = directRecords.length > 0 ? directRecords : legacySearchLogRecords(parsed);
  if (records.length === 0 && !("recordCount" in parsedRecord)) return null;
  const count = typeof parsedRecord.recordCount === "number" ? parsedRecord.recordCount : records.length;
  const lines = records.slice(0, 5).map(readableLog).filter((line): line is string => line !== null);
  return [
    `Returned ${count} log${count === 1 ? '' : 's'}${count > 5 ? '; showing the first 5' : ''}.`,
    ...lines
  ];
}

function knowledgeLines(parsed: unknown): readonly string[] | null {
  const parsedRecord = record(parsed);
  const results = Array.isArray(parsedRecord.results) ? parsedRecord.results : null;
  if (results === null) return null;
  const lines = results.slice(0, 5).map((item) => {
    const result = record(item);
    return String(result.source ?? result.title ?? result.documentId ?? "Untitled source");
  });
  return [`Matched ${results.length} knowledge record${results.length === 1 ? '' : 's'}.`, ...lines];
}

function genericLines(parsed: unknown): readonly string[] {
  if (parsed === null) return ["The tool did not return a result summary."];
  if (typeof parsed === "string") {
    if (/^[\[{]/.test(parsed.trim())) return ["The tool returned structured data that could not be parsed. The raw payload is hidden."];
    return [parsed.length > 500 ? `${parsed.slice(0, 497)}...` : parsed];
  }
  if (Array.isArray(parsed)) return [`The tool returned ${parsed.length} results. The raw structure is hidden.`];
  const parsedRecord = record(parsed);
  const lines = Object.entries(parsedRecord)
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .slice(0, 6)
    .map(([key, value]) => `${key}：${String(value)}`);
  return lines.length > 0 ? lines : ["The tool returned structured data. The raw payload is hidden."];
}

function toolOutput(tool: ToolCallAudit): readonly string[] {
  if (tool.errorMessage) return [`Call failed: ${tool.errorMessage}`];
  const parsed = parseSummary(tool.resultSummary);
  if (tool.toolName === "SearchLog") return searchLogLines(parsed) ?? genericLines(parsed);
  if (tool.toolName === "knowledge_retrieval") return knowledgeLines(parsed) ?? genericLines(parsed);
  return genericLines(parsed);
}
</script>

<template>
  <section class="aiops-execution" aria-label="Diagnostic execution">
    <header>
      <div><p>Execution</p><h3>Planner → Executor → Replanner</h3></div>
      <GitBranch :size="18" aria-hidden="true" />
    </header>

    <p v-if="chain === null" class="aiops-execution__empty">Select a diagnosis to see the saved execution and tool calls.</p>
    <template v-else>
      <ol v-if="executionSteps.length" class="aiops-execution__steps">
        <li v-for="step in executionSteps" :key="step.id">
          <span class="aiops-execution__index">{{ step.sequence }}</span>
          <div>
            <strong>{{ stepTitle(step) }}</strong>
            <div class="aiops-execution__output">
              <p v-for="line in stepOutput(step)" :key="line">{{ line }}</p>
            </div>
            <UserFeedbackControl target-type="diagnostic_step" :target-id="step.id" compact />
          </div>
        </li>
      </ol>
      <p v-else class="aiops-execution__empty">This task has no execution steps to show yet.</p>

      <section class="aiops-execution__tools" aria-label="Tool calls">
        <header><h4><Wrench :size="15" aria-hidden="true" />Tool calls</h4><span>{{ chain.toolCalls.length }}</span></header>
        <div v-if="chain.toolCalls.length" class="aiops-execution__tool-list">
          <details v-for="tool in chain.toolCalls" :key="tool.id">
            <summary>
              <span><strong>{{ tool.toolName }}</strong><AsyncStatusBadge :status="tool.status" compact /></span>
              <ChevronDown :size="15" aria-hidden="true" />
            </summary>
            <div class="aiops-execution__tool-output">
              <p v-for="line in toolOutput(tool)" :key="line">{{ line }}</p>
            </div>
          </details>
        </div>
        <p v-else class="aiops-execution__empty">This task has no tool calls.</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.aiops-execution { min-width: 0; padding: 1.2rem; }
.aiops-execution > header { align-items: center; display: flex; justify-content: space-between; }
.aiops-execution > header p { color: var(--text-tertiary); font-size: 0.7rem; font-weight: 700; margin: 0 0 0.3rem; }
h3 { font-size: 0.95rem; font-weight: 680; margin: 0; }
.aiops-execution__empty { color: var(--text-tertiary); font-size: 0.78rem; line-height: 1.5; margin: 0.85rem 0 0; }
.aiops-execution__steps { display: grid; gap: 0; list-style: none; margin: 1rem 0 0; padding: 0; }
.aiops-execution__steps li { display: grid; gap: 0.65rem; grid-template-columns: 1.65rem minmax(0, 1fr); padding-bottom: 1rem; position: relative; }
.aiops-execution__steps li:not(:last-child)::after { background: var(--line-strong); content: ""; height: calc(100% - 1.75rem); left: 0.8rem; position: absolute; top: 1.7rem; width: 1px; }
.aiops-execution__index { align-items: center; background: var(--surface-inset); border: 1px solid var(--line-strong); border-radius: 50%; color: var(--text-secondary); display: inline-flex; font-size: 0.68rem; font-weight: 750; height: 1.65rem; justify-content: center; position: relative; width: 1.65rem; z-index: 1; }
.aiops-execution__steps strong { display: block; font-size: 0.8rem; line-height: 1.45; overflow-wrap: anywhere; padding-top: 0.18rem; }
.aiops-execution__output, .aiops-execution__tool-output { border-left: 2px solid var(--line-strong); color: var(--text-secondary); margin-top: 0.5rem; padding: 0.05rem 0 0.05rem 0.7rem; }
.aiops-execution__output p, .aiops-execution__tool-output p { font-size: 0.72rem; line-height: 1.55; margin: 0.22rem 0; overflow-wrap: anywhere; word-break: break-word; }
.aiops-execution__tools { border-top: 1px solid var(--line); margin-top: 0.15rem; padding-top: 1rem; }
.aiops-execution__tools > header { align-items: center; display: flex; justify-content: space-between; }
.aiops-execution__tools h4 { align-items: center; color: var(--text-secondary); display: flex; font-size: 0.8rem; gap: 0.35rem; margin: 0; }
.aiops-execution__tools > header > span { color: var(--text-tertiary); font-size: 0.72rem; }
.aiops-execution__tool-list { display: grid; gap: 0.45rem; margin-top: 0.75rem; }
.aiops-execution__tool-list details { border-bottom: 1px solid var(--line); padding: 0 0 0.5rem; }
.aiops-execution__tool-list summary { align-items: center; cursor: pointer; display: flex; justify-content: space-between; list-style: none; min-height: 2rem; }
.aiops-execution__tool-list summary::-webkit-details-marker { display: none; }
.aiops-execution__tool-list summary > span { align-items: center; display: flex; gap: 0.5rem; min-width: 0; }
.aiops-execution__tool-list summary strong { font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aiops-execution__tool-list summary > svg { color: var(--text-tertiary); flex: 0 0 auto; transition: transform var(--transition-fast); }
.aiops-execution__tool-list details[open] summary > svg { transform: rotate(180deg); }
@media (max-width: 560px) { .aiops-execution { padding: 1rem; } }
</style>
