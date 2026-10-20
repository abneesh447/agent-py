// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import AsyncStatusBadge from "../src/components/AsyncStatusBadge.vue";
import { describeAsyncStatus } from "../src/ui/asyncStatus";

describe("English workspace status", () => {
  it("describes async statuses in English", () => {
    expect(describeAsyncStatus("pending")).toMatchObject({ label: "Waiting", tone: "waiting", active: true });
    expect(describeAsyncStatus("accepted")).toMatchObject({ label: "Preparing", tone: "waiting", active: true });
    expect(describeAsyncStatus("running")).toMatchObject({ label: "Running", tone: "running", active: true });
    expect(describeAsyncStatus("succeeded")).toMatchObject({ label: "Completed", tone: "success", active: false });
    expect(describeAsyncStatus("indexed")).toMatchObject({ label: "Indexed", tone: "success", active: false });
    expect(describeAsyncStatus("failed")).toMatchObject({ label: "Failed", tone: "danger", active: false });
  });

  it("exposes activity in text as well as color", () => {
    const wrapper = mount(AsyncStatusBadge, {
      props: { status: "running", detail: "Writing to the knowledge base" }
    });

    expect(wrapper.get('[role="status"]').text()).toContain("Running");
    expect(wrapper.text()).toContain("Writing to the knowledge base");
    expect(wrapper.attributes("data-tone")).toBe("running");
  });
});
