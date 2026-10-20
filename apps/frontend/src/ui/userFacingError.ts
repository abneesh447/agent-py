import type { ApiErrorMessage } from "@agent-py/api-contracts";

const ERROR_MESSAGES: Readonly<Record<ApiErrorMessage["code"], string>> = {
  CHAT_CONTEXT_LIMIT_REACHED: "The context window is 95% full. Compact the conversation manually before continuing.",
  AUTH_INVALID_CREDENTIALS: "The email or password is incorrect. Try again.",
  AUTH_FORBIDDEN: "You do not have permission to access this data.",
  AUTH_SESSION_REVOKED: "Your session has expired. Sign in again.",
  AUTH_UNAUTHENTICATED: "Sign in to continue.",
  BUSINESS_CONFLICT: "That data already exists or conflicts with the current state. Check it and try again.",
  BUSINESS_NOT_FOUND: "The requested data was not found. It may have been deleted, or you may not have access.",
  VALIDATION_INVALID_ARGUMENT: "The submitted information is invalid. Check it and try again.",
  VALIDATION_MISSING_FIELD: "Fill in the required fields and try again.",
  SYSTEM_INTERNAL_ERROR: "The system could not complete that request. Try again shortly.",
  SYSTEM_UNAVAILABLE: "The service is temporarily unavailable. Try again shortly."
};

function isApiErrorMessage(value: unknown): value is ApiErrorMessage {
  return value !== null && typeof value === "object" && "code" in value &&
    typeof value.code === "string" && value.code in ERROR_MESSAGES;
}

export function toUserFacingError(error: unknown): string {
  if (error !== null && typeof error === "object" && "error" in error && isApiErrorMessage(error.error)) {
    return ERROR_MESSAGES[error.error.code];
  }
  return "The operation could not be completed. Try again.";
}
