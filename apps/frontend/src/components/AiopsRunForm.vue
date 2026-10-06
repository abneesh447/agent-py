<script setup lang="ts">
import { Play, Square } from "lucide-vue-next";
import { ref } from "vue";

const emit = defineEmits<{ cancel: []; run: [query: string, alert: Record<string, unknown> | undefined] }>();
defineProps<{ readonly disabled: boolean; readonly isRunning: boolean }>();

const query = ref("");
const alertText = ref("");
const validationMessage = ref<string | null>(null);

function submit(): void {
  const trimmedQuery = query.value.trim();
  if (trimmedQuery.length === 0) {
    validationMessage.value = "Describe the operational signal to investigate.";
    return;
  }
  let alert: Record<string, unknown> | undefined;
  if (alertText.value.trim().length > 0) {
    try {
      const parsed: unknown = JSON.parse(alertText.value);
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new Error();
      }
      alert = parsed as Record<string, unknown>;
    } catch {
      validationMessage.value = "Alert context must be a valid JSON object.";
      return;
    }
  }
  validationMessage.value = null;
  emit("run", trimmedQuery, alert);
}
</script>

<template>
  <form class="aiops-run-form" @submit.prevent="submit">
    <div class="aiops-run-form__header"><div><p>Start a diagnosis</p><h2>Describe the operational signal you observed</h2></div><span v-if="isRunning" role="status">Diagnosis running</span></div>
    <label>Diagnosis question<textarea v-model="query" :disabled="disabled || isRunning" aria-label="Diagnosis question" placeholder="Example: investigate elevated checkout API latency" rows="3" /></label>
    <label>Alert context <span>(optional)</span><textarea v-model="alertText" :disabled="disabled || isRunning" aria-label="Alert context" placeholder='{"service":"checkout","severity":"high"}' rows="3" /></label>
    <p v-if="validationMessage" class="aiops-run-form__error" role="alert">{{ validationMessage }}</p>
    <div class="aiops-run-form__commands"><button :disabled="disabled || isRunning" type="submit"><Play :size="16" aria-hidden="true" />{{ isRunning ? "Diagnosis running" : "Start diagnosis" }}</button><button v-if="isRunning" class="aiops-run-form__cancel" type="button" @click="emit('cancel')"><Square :size="14" aria-hidden="true" />Cancel task</button></div>
  </form>
</template>

<style scoped>
.aiops-run-form { background: #fbfbfc; border-bottom: 1px solid var(--line); display: grid; gap: 0.9rem; padding: 1.2rem; }
.aiops-run-form__header { align-items: center; display: flex; gap: 1rem; justify-content: space-between; }
.aiops-run-form__header p { color: var(--text-tertiary); font-size: 0.7rem; font-weight: 700; margin: 0 0 0.3rem; }
h2 { font-size: 1rem; font-weight: 680; margin: 0; }
.aiops-run-form__header span { color: var(--accent-strong); font-size: 0.76rem; font-weight: 650; }
label { color: var(--text-secondary); display: grid; font-size: 0.78rem; font-weight: 650; gap: 0.4rem; }
label > span { color: var(--text-tertiary); font-weight: 500; }
textarea { background: var(--surface-raised); border: 1px solid var(--line-strong); border-radius: 0.45rem; color: var(--text-primary); line-height: 1.5; padding: 0.6rem; resize: vertical; }
textarea:focus { border-color: var(--accent); outline: 3px solid var(--accent-focus); }
button { align-items: center; background: var(--accent); border-radius: 0.45rem; color: white; display: inline-flex; font-size: 0.82rem; font-weight: 650; gap: 0.4rem; justify-self: start; min-height: 2.5rem; padding: 0 0.8rem; }
button:hover:not(:disabled) { background: var(--accent-strong); }
button:disabled { cursor: not-allowed; opacity: 0.6; }
.aiops-run-form__commands { display: flex; gap: 0.5rem; }.aiops-run-form__cancel { background: transparent; border: 1px solid var(--line-strong); color: var(--status-danger-text); }.aiops-run-form__cancel:hover:not(:disabled) { background: var(--status-danger-bg); }
.aiops-run-form__error { color: var(--danger); font-size: 0.8rem; margin: 0; }
</style>
