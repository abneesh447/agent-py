// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import type { DocumentChunkPreview, DocumentIndexTask, KnowledgeDocument } from "@agent-py/api-contracts";

import KnowledgeDocumentList from "../src/components/KnowledgeDocumentList.vue";
import KnowledgeUpload from "../src/components/KnowledgeUpload.vue";

const document: KnowledgeDocument = {
  id: "doc_1",
  knowledgeBaseId: "kb_1",
  ownerUserId: "user_1",
  filename: "restart.md",
  sizeBytes: 42,
  mimeType: "text/markdown",
  contentHash: "sha256:abc",
  status: "ready",
  indexStatus: "failed",
  uploadedAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
  source: "upload"
};

const task: DocumentIndexTask = {
  id: "task_1",
  ownerUserId: "user_1",
  knowledgeBaseId: "kb_1",
  documentId: "doc_1",
  status: "failed",
  failureReason: "Embedding unavailable",
  retryOfTaskId: null,
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
  startedAt: "2026-07-10T00:00:00.000Z",
  completedAt: "2026-07-10T00:00:01.000Z"
};

const preview: DocumentChunkPreview = {
  configuration: { strategy: "markdown-heading" },
  totalChunks: 2,
  truncated: false,
  items: [
    { index: 0, characterCount: 42, excerpt: "# Restart\nRestart the API." },
    { index: 1, characterCount: 37, excerpt: "## Verify\nCheck readiness." }
  ]
};

describe("knowledge components", () => {
  it("rejects a file outside the shared upload policy before emitting an upload", async () => {
    const wrapper = mount(KnowledgeUpload, { props: { disabled: false } });
    const input = wrapper.get('input[type="file"]');
    const file = new File(["binary"], "unsafe.exe", { type: "application/octet-stream" });

    Object.defineProperty(input.element, "files", { configurable: true, value: [file] });
    await input.trigger("change");

    expect(wrapper.text()).toContain("Only Markdown (.md) and PDF (.pdf) files are supported");
    expect(wrapper.emitted("upload")).toBeUndefined();
  });

  it("only shows fixed-character numeric controls and emits compact non-fixed chunking", async () => {
    const wrapper = mount(KnowledgeUpload, { props: { disabled: false } });

    expect(wrapper.text()).toContain("Max characters");
    await wrapper.get("select").setValue("paragraph");
    expect(wrapper.text()).not.toContain("Max characters");
    expect(wrapper.text()).toContain("Character and overlap settings are not used");
    expect(wrapper.findAll('input[type="number"]')).toHaveLength(0);

    const input = wrapper.get('input[type="file"]');
    const file = new File(["# Runbook"], "runbook.md", { type: "text/markdown" });
    Object.defineProperty(input.element, "files", { configurable: true, value: [file] });
    await input.trigger("change");

    expect(wrapper.emitted("upload")?.[0]).toEqual([file, { strategy: "paragraph" }]);
  });

  it("shows index failure context and emits retry, inline detail, and delete actions", async () => {
    const wrapper = mount(KnowledgeDocumentList, {
      props: { documents: [document], indexTasks: [task] }
    });

    expect(wrapper.text()).toContain("Failed");
    expect(wrapper.text()).toContain("Embedding unavailable");
    await wrapper.get('button[title="Retry indexing"]') .trigger("click");
    const detail = wrapper.get("details");
    (detail.element as HTMLDetailsElement).open = true;
    await detail.trigger("toggle");
    await wrapper.get('button[title="Delete document"]') .trigger("click");

    expect(wrapper.emitted("retry")).toEqual([[task]]);
    expect(wrapper.emitted("detail")).toEqual([[document]]);
    expect(wrapper.emitted("delete")).toEqual([[document]]);
  });

  it("keeps each document detail collapsed inline until the user expands it", () => {
    const wrapper = mount(KnowledgeDocumentList, {
      props: { documents: [document], indexTasks: [task] }
    });

    expect(wrapper.get("summary").text()).toContain("Show document details and chunk preview");
    expect(wrapper.get("details").attributes("open")).toBeUndefined();
  });

  it("renders metadata and chunk previews inside the matching document disclosure", () => {
    const wrapper = mount(KnowledgeDocumentList, {
      props: {
        documents: [document],
        indexTasks: [task],
        preview,
        selectedDocument: document
      }
    });

    expect(wrapper.text()).toContain("File size");
    expect(wrapper.text()).toContain("2 chunks");
    expect(wrapper.text()).toContain("Restart the API.");
  });
});
