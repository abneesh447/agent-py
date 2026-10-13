export type AsyncStatusTone = "neutral" | "waiting" | "running" | "success" | "danger";

export interface AsyncStatusDescription {
  readonly label: string;
  readonly tone: AsyncStatusTone;
  readonly active: boolean;
}

const STATUS_DESCRIPTIONS: Readonly<Record<string, AsyncStatusDescription>> = {
  pending: { label: "Waiting", tone: "waiting", active: true },
  accepted: { label: "Preparing", tone: "waiting", active: true },
  queued: { label: "Queued", tone: "waiting", active: true },
  started: { label: "Calling", tone: "running", active: true },
  delta: { label: "Returning results", tone: "running", active: true },
  running: { label: "Running", tone: "running", active: true },
  streaming: { label: "Generating", tone: "running", active: true },
  indexing: { label: "Indexing", tone: "running", active: true },
  indexed: { label: "Indexed", tone: "success", active: false },
  active: { label: "Firing", tone: "danger", active: true },
  succeeded: { label: "Completed", tone: "success", active: false },
  completed: { label: "Completed", tone: "success", active: false },
  cancelled: { label: "Cancelled", tone: "neutral", active: false },
  ready: { label: "Ready", tone: "success", active: false },
  degraded: { label: "Degraded", tone: "danger", active: false },
  failed: { label: "Failed", tone: "danger", active: false },
  error: { label: "Failed", tone: "danger", active: false }
};

const UNKNOWN_STATUS: AsyncStatusDescription = {
  label: "Unknown status",
  tone: "neutral",
  active: false
};

export function describeAsyncStatus(status: string | null | undefined): AsyncStatusDescription {
  if (status === null || status === undefined) {
    return UNKNOWN_STATUS;
  }
  return STATUS_DESCRIPTIONS[status.toLowerCase()] ?? UNKNOWN_STATUS;
}
