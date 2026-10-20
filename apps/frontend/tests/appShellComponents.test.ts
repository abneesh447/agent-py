// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import AppEmptyState from "../src/components/AppEmptyState.vue";
import AppErrorState from "../src/components/AppErrorState.vue";
import AppFeedback from "../src/components/AppFeedback.vue";
import AppLoadingState from "../src/components/AppLoadingState.vue";
import WorkspaceNavigation from "../src/components/WorkspaceNavigation.vue";
import { useFeedbackStore } from "../src/stores/feedback";

afterEach(() => {
  vi.useRealTimers();
});

describe("application shell components", () => {
  it("renders accessible loading, empty, and error feedback", () => {
    expect(mount(AppLoadingState, { props: { label: "Loading workspace" } }).get("[role=status]").text()).toContain(
      "Loading workspace"
    );
    expect(mount(AppEmptyState, { props: { title: "No documents yet" } }).text()).toContain(
      "No documents yet"
    );
    expect(mount(AppErrorState, { props: { message: "Request failed" } }).get("[role=alert]").text()).toContain(
      "Request failed"
    );
  });

  it("uses Chinese labels for the active workspace route", () => {
    const wrapper = mount(WorkspaceNavigation, {
      props: { activePath: "/chat" },
      slots: { "chat-history": '<div data-testid="chat-history-slot">history slot</div>' },
      global: {
        stubs: {
          RouterLink: {
            props: ["to"],
            template: '<a :href="to"><slot /></a>'
          }
        }
      }
    });

    expect(wrapper.attributes("aria-label")).toBe("Workspace navigation");
    expect(wrapper.get('[aria-current="page"]').text()).toContain("Chat");
    expect(wrapper.get('[data-testid="chat-history-slot"]').text()).toBe("history slot");
    expect(wrapper.text()).toContain("Knowledge");
    expect(wrapper.text()).toContain("Diagnosis");
    const markup = wrapper.html();
    expect(markup.indexOf("history slot")).toBeGreaterThan(markup.indexOf('href="/chat"'));
    expect(markup.indexOf("history slot")).toBeLessThan(markup.indexOf('href="/knowledge"'));
  });

  it("automatically dismisses global feedback three seconds after the latest message", async () => {
    vi.useFakeTimers();
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(AppFeedback, { global: { plugins: [pinia] } });
    const feedback = useFeedbackStore();

    feedback.show("success", "Feedback saved");
    await nextTick();
    expect(wrapper.get("[role=alert]").text()).toContain("Feedback saved");

    await vi.advanceTimersByTimeAsync(2_000);
    feedback.show("success", "MCP connection saved");
    await nextTick();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(wrapper.get("[role=alert]").text()).toContain("MCP connection saved");

    await vi.advanceTimersByTimeAsync(2_000);
    await nextTick();
    expect(wrapper.find("[role=alert]").exists()).toBe(false);
  });
});
