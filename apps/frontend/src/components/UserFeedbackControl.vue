<script setup lang="ts">
import { MessageSquareText, ThumbsDown, ThumbsUp, X } from "lucide-vue-next";
import { computed, onMounted, ref, watch } from "vue";

import type { FeedbackRating, FeedbackTargetType } from "@agent-py/api-contracts";

import { useUserFeedbackStore } from "../stores/userFeedback";

const props = defineProps<{
  readonly compact?: boolean;
  readonly subjectId?: string;
  readonly targetId: string;
  readonly targetType: FeedbackTargetType;
}>();

const feedback = useUserFeedbackStore();
const expanded = ref(false);
const reason = ref("");
const comment = ref("");
const correction = ref("");
const current = computed(() => feedback.get(props.targetType, props.targetId, props.subjectId));
const pending = computed(() => feedback.isPending(props.targetType, props.targetId, props.subjectId));

watch(current, (value) => {
  reason.value = value?.reason ?? "";
  comment.value = value?.comment ?? "";
  correction.value = value?.correction ?? "";
}, { immediate: true });

onMounted(() => {
  void feedback.ensureLoaded(props.targetType, props.targetId).catch(() => undefined);
});

async function rate(rating: FeedbackRating): Promise<void> {
  await feedback.upsert({
    targetType: props.targetType,
    targetId: props.targetId,
    ...(props.subjectId === undefined ? {} : { subjectId: props.subjectId }),
    rating,
    ...(reason.value ? { reason: reason.value } : {}),
    ...(comment.value ? { comment: comment.value } : {}),
    ...(correction.value ? { correction: correction.value } : {})
  });
  if (rating === "negative") expanded.value = true;
}

async function remove(): Promise<void> {
  if (current.value === undefined) return;
  await feedback.remove(current.value.id);
  expanded.value = false;
}
</script>

<template>
  <div class="user-feedback" :class="{ 'user-feedback--compact': compact }">
    <div class="user-feedback__commands" aria-label="Content feedback">
      <button type="button" title="Helpful" aria-label="Helpful" :aria-pressed="current?.rating === 'positive'" :disabled="pending" @click="rate('positive')"><ThumbsUp :size="compact ? 13 : 15" aria-hidden="true" /></button>
      <button type="button" title="Needs improvement" aria-label="Needs improvement" :aria-pressed="current?.rating === 'negative'" :disabled="pending" @click="rate('negative')"><ThumbsDown :size="compact ? 13 : 15" aria-hidden="true" /></button>
      <button type="button" title="Add feedback" aria-label="Add feedback" :aria-expanded="expanded" @click="expanded = !expanded"><MessageSquareText :size="compact ? 13 : 15" aria-hidden="true" /></button>
      <span v-if="pending">Saving</span>
      <span v-else-if="current">Feedback saved</span>
    </div>
    <form v-if="expanded" class="user-feedback__form" @submit.prevent="rate(current?.rating ?? 'negative')">
      <header><strong>Add feedback</strong><button type="button" title="Collapse" aria-label="Collapse feedback" @click="expanded = false"><X :size="14" aria-hidden="true" /></button></header>
      <label><span>Issue type</span><select v-model="reason"><option value="">Select</option><option value="incorrect">Incorrect</option><option value="incomplete">Incomplete</option><option value="citation">Irrelevant citation</option><option value="unsafe">Advice cannot be applied</option><option value="other">Other</option></select></label>
      <label><span>Details</span><textarea v-model="comment" maxlength="2000" rows="2" placeholder="What should be improved?" /></label>
      <label><span>Suggested correction</span><textarea v-model="correction" maxlength="4000" rows="2" placeholder="Optional: provide a more accurate version" /></label>
      <div><button type="button" v-if="current" @click="remove">Delete feedback</button><button type="submit" :disabled="pending">Save</button></div>
    </form>
  </div>
</template>

<style scoped>
.user-feedback { display: grid; gap: 0.45rem; justify-items: start; }
.user-feedback__commands { align-items: center; color: var(--text-tertiary); display: flex; gap: 0.2rem; }
.user-feedback__commands button { align-items: center; border-radius: 0.35rem; display: inline-flex; height: 1.85rem; justify-content: center; width: 1.85rem; }
.user-feedback__commands button:hover, .user-feedback__commands button[aria-pressed="true"] { background: var(--surface-hover); color: var(--accent-strong); }
.user-feedback__commands span { font-size: 0.68rem; margin-left: 0.2rem; }
.user-feedback__form { background: var(--surface-raised); border: 1px solid var(--line); display: grid; gap: 0.65rem; max-width: 28rem; padding: 0.75rem; width: min(28rem, 100%); }
.user-feedback__form header, .user-feedback__form > div { align-items: center; display: flex; justify-content: space-between; }
.user-feedback__form header strong { font-size: 0.78rem; }
.user-feedback__form header button { color: var(--text-tertiary); }
.user-feedback__form label { color: var(--text-secondary); display: grid; font-size: 0.7rem; gap: 0.3rem; }
.user-feedback__form select, .user-feedback__form textarea { background: var(--surface); border: 1px solid var(--line-strong); border-radius: 0.35rem; color: var(--text-primary); font: inherit; padding: 0.5rem; resize: vertical; }
.user-feedback__form > div { justify-content: flex-end; gap: 0.45rem; }
.user-feedback__form > div button { border: 1px solid var(--line-strong); border-radius: 0.35rem; font-size: 0.72rem; min-height: 1.9rem; padding: 0 0.55rem; }
.user-feedback__form > div button:last-child { background: var(--accent-strong); border-color: var(--accent-strong); color: white; }
.user-feedback--compact .user-feedback__commands button { height: 1.55rem; width: 1.55rem; }
</style>
