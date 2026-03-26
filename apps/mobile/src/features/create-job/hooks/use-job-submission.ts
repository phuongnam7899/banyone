import React from "react";
import { Platform } from "react-native";
import type { CreateGenerationJobRequestBody } from "@/features/create-job/types/create-generation-job";

type ViolationDetail = {
  code: string;
  message: string;
  fixAction: string;
  slot: "video" | "image";
};

type JobValidationErrorDetails = {
  violationSummary: {
    videoStatus: "pending" | "valid" | "invalid-with-fix";
    imageStatus: "pending" | "valid" | "invalid-with-fix";
  };
  violations: ViolationDetail[];
};

type SubmitAcceptedAck = {
  type: "accepted";
  jobId: string;
  status: "queued";
};

type SubmitRejectedAck = {
  type: "rejected";
  code: string;
  traceId: string;
  details?: JobValidationErrorDetails;
  violations: ViolationDetail[];
};

type SubmitAck = SubmitAcceptedAck | SubmitRejectedAck;

function resolveApiBaseUrl(): string {
  // Recommended override for real devices/emulators.
  // Example: EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:3000
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0)
    return fromEnv.trim();

  // Sensible local dev defaults:
  // - iOS simulator (and web) can reach localhost
  // - Android emulator needs the special loopback alias
  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

const API_BASE_URL = resolveApiBaseUrl();
const ENDPOINT_PATH = "/v1/generation-jobs";

function generateIdempotencyKey(): string {
  // No extra dependency: deterministically stable per attempt (we persist it in state/ref).
  // Good enough for idempotency safety: uniqueness + immutability during the request.
  return `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function useJobSubmission(input: CreateGenerationJobRequestBody): {
  isSubmitting: boolean;
  ack: SubmitAck | null;
  submit: () => Promise<void>;
} {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [ack, setAck] = React.useState<SubmitAck | null>(null);

  const idempotencyKeyRef = React.useRef<string | null>(null);
  const isSubmittingRef = React.useRef(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const timeoutMs = (() => {
    const raw = process.env.EXPO_PUBLIC_JOB_SUBMIT_TIMEOUT_MS;
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 20000;
  })();

  const submit = React.useCallback(async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const startedAt = Date.now();
    const idempotencyKey =
      idempotencyKeyRef.current ?? generateIdempotencyKey();
    idempotencyKeyRef.current = idempotencyKey;

    setIsSubmitting(true);
    setAck(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const res = await fetch(`${API_BASE_URL}${ENDPOINT_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-banyone-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(input),
        signal: abortController.signal,
      });

      const json = (await res.json()) as
        | { data: { jobId: string; status: "queued" }; error: null }
        | {
            data: null;
            error: {
              code: string;
              retryable: boolean;
              message: string;
              traceId: string;
              details?: JobValidationErrorDetails;
            };
          };

      if (json.error === null) {
        setAck({
          type: "accepted",
          jobId: json.data.jobId,
          status: json.data.status,
        });

        console.info("telemetry.jobs.generation.acknowledged.v1", {
          outcome: "accepted",
          jobId: json.data.jobId,
          status: json.data.status,
          clientAckLatencyMs: Date.now() - startedAt,
        });
      } else {
        const details = json.error.details;
        const violations = details?.violations ?? [];

        setAck({
          type: "rejected",
          code: json.error.code ?? "UNKNOWN",
          traceId: json.error.traceId ?? "",
          details,
          violations,
        });

        console.info("telemetry.jobs.generation.acknowledged.v1", {
          outcome: "rejected",
          rejectionCodes: violations.map((v) => v.code),
          clientAckLatencyMs: Date.now() - startedAt,
        });
      }
    } catch {
      setAck({
        type: "rejected",
        code: abortController.signal.aborted ? "NETWORK_TIMEOUT" : "NETWORK_ERROR",
        traceId: "",
        violations: [],
      });
    } finally {
      // Clear only after acknowledgment has been parsed and rendered.
      idempotencyKeyRef.current = null;
      isSubmittingRef.current = false;
      abortControllerRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setIsSubmitting(false);
    }
  }, [input, timeoutMs]);

  return { isSubmitting, ack, submit };
}
