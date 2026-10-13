import { DOCUMENT_UPLOAD_POLICY } from "@agent-py/api-contracts";

const MARKDOWN_MIME_TYPES = new Set(["", "application/octet-stream", "text/markdown", "text/plain"]);
const PDF_MIME_TYPES = new Set(["", "application/octet-stream", "application/pdf"]);

export function validateKnowledgeDocumentFile(file: File): string | null {
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (file.size > DOCUMENT_UPLOAD_POLICY.maxSizeBytes) {
    return `File size cannot exceed ${formatBytes(DOCUMENT_UPLOAD_POLICY.maxSizeBytes)}.`;
  }
  if (!DOCUMENT_UPLOAD_POLICY.allowedExtensions.includes(extension as never)) {
    return supportedFormatsMessage();
  }
  if (extension === ".md" && !MARKDOWN_MIME_TYPES.has(file.type)) {
    return `This Markdown file type is not allowed (received ${file.type}). Upload a .md file.`;
  }
  if (extension === ".pdf" && !PDF_MIME_TYPES.has(file.type)) {
    return `This PDF file type is not allowed (received ${file.type}). Upload a valid .pdf file.`;
  }
  return null;
}

export function supportedFormatsMessage(): string {
  return `Only Markdown (.md) and PDF (.pdf) files are supported, up to ${formatBytes(DOCUMENT_UPLOAD_POLICY.maxSizeBytes)} each.`;
}

export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
