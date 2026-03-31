import type { CreateJobDraftTelemetryEvent } from "@banyone/contracts";
import {
  API_RATE_LIMIT_ERROR_CODE,
  isApiRateLimitDetails,
} from "@banyone/contracts";
import React from "react";
import { Platform } from "react-native";

import { useBanyoneAuth } from "@/features/auth/auth-context";
import type { CreateGenerationJobRequestBody } from "@/features/create-job/types/create-generation-job";
import { banyoneAuthenticatedFetch } from "@/infra/api-client/authenticated-fetch";
import { parseBanyoneApiEnvelopeResponse } from "@/infra/api-client/parse-json-envelope";

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

type SubmitRateLimitedAck = {
  type: "rate-limited";
  message: string;
  retryAfterSec: number | null;
  traceId: string;
};

type SubmitDisclosureRequiredAck = {
  type: "disclosure-required";
  currentVersion: string;
  traceId: string;
};

type SubmitAck =
  | SubmitAcceptedAck
  | SubmitRejectedAck
  | SubmitRateLimitedAck
  | SubmitDisclosureRequiredAck;

export type UseJobSubmissionOptions = {
  initialIdempotencyKey?: string | null;
  onPendingIdempotencyKeyChange?: (key: string | null) => void;
};

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0)
    return fromEnv.trim();

  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

const API_BASE_URL = resolveApiBaseUrl();
const ENDPOINT_PATH = "/v1/generation-jobs";
const DISCLOSURE_ACK_PATH = "/v1/synthetic-media-disclosure/acknowledge";
const DISCLOSURE_REQUIRED_ERROR_CODE = "DISCLOSURE_REQUIRED";

function generateIdempotencyKey(): string {
  return `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function emitDraftTelemetry(event: CreateJobDraftTelemetryEvent): void {
  console.info(`telemetry.${event.event}.v1`, event);
}

export function useJobSubmission(
  input: CreateGenerationJobRequestBody,
  options: UseJobSubmissionOptions = {},
): {
  isSubmittingJob: boolean;
  ack: SubmitAck | null;
  submit: () => Promise<void>;
  acknowledgeDisclosure: (version: string) => Promise<boolean>;
} {
  const { getIdToken } = useBanyoneAuth();
  const { initialIdempotencyKey = null, onPendingIdempotencyKeyChange } = options;

  const [isSubmittingJob, setIsSubmittingJob] = React.useState(false);
  const [ack, setAck] = React.useState<SubmitAck | null>(null);

  const idempotencyKeyRef = React.useRef<string | null>(null);
  const hadNetworkFailureSinceLastTerminalAckRef = React.useRef(false);
  const isSubmittingRef = React.useRef(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (initialIdempotencyKey) {
      idempotencyKeyRef.current = initialIdempotencyKey;
    }
  }, [initialIdempotencyKey]);

  const timeoutMs = (() => {
    const raw = process.env.EXPO_PUBLIC_JOB_SUBMIT_TIMEOUT_MS;
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 20000;
  })();

  const clearIdempotency = React.useCallback(() => {
    idempotencyKeyRef.current = null;
    onPendingIdempotencyKeyChange?.(null);
  }, [onPendingIdempotencyKeyChange]);

  const submit = React.useCallback(async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const startedAt = Date.now();

    const hadNetworkFailure = hadNetworkFailureSinceLastTerminalAckRef.current;
    const existingKey = idempotencyKeyRef.current;
    const idempotencyKey = existingKey ?? generateIdempotencyKey();
    idempotencyKeyRef.current = idempotencyKey;
    if (!existingKey) {
      onPendingIdempotencyKeyChange?.(idempotencyKey);
    } else if (hadNetworkFailure) {
      emitDraftTelemetry({
        event: "create_job_submit_retry_after_failure",
        hasVideo: Boolean(input.video.uri),
        hasImage: Boolean(input.image.uri),
        hadPendingIdempotencyKey: true,
      });
    }

    setIsSubmittingJob(true);
    setAck(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => abortController.abort(), timeoutMs);

    const finishSubmittingUi = () => {
      isSubmittingRef.current = false;
      abortControllerRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setIsSubmittingJob(false);
    };

    try {
      const res = await banyoneAuthenticatedFetch(
        `${API_BASE_URL}${ENDPOINT_PATH}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-banyone-idempotency-key": idempotencyKey,
          },
          body: JSON.stringify(input),
          signal: abortController.signal,
        },
        getIdToken,
      );

      const parsed = await parseBanyoneApiEnvelopeResponse(res);
      if (!parsed.ok) {
        hadNetworkFailureSinceLastTerminalAckRef.current = true;
        setAck({
          type: "rejected",
          code: abortController.signal.aborted ? "NETWORK_TIMEOUT" : "NETWORK_ERROR",
          traceId: "",
          violations: [],
        });
        return;
      }

      const envelope = parsed.envelope;

      if (envelope.error !== null) {
        hadNetworkFailureSinceLastTerminalAckRef.current = false;
        clearIdempotency();
        const err = envelope.error;

        if (err.code === API_RATE_LIMIT_ERROR_CODE) {
          const d = isApiRateLimitDetails(err.details) ? err.details : null;
          setAck({
            type: "rate-limited",
            message: err.message,
            retryAfterSec: d?.retryAfterSec ?? null,
            traceId: err.traceId ?? "",
          });
          console.info("telemetry.jobs.generation.acknowledged.v1", {
            outcome: "rate_limited",
            clientAckLatencyMs: Date.now() - startedAt,
          });
          return;
        }
        if (err.code === DISCLOSURE_REQUIRED_ERROR_CODE) {
          const details = err.details as { currentVersion?: unknown } | undefined;
          const currentVersion =
            typeof details?.currentVersion === "string" &&
            details.currentVersion.trim().length > 0
              ? details.currentVersion.trim()
              : "v1";
          setAck({
            type: "disclosure-required",
            currentVersion,
            traceId: err.traceId ?? "",
          });
          return;
        }

        const details = err.details as JobValidationErrorDetails | undefined;
        const violations = details?.violations ?? [];

        setAck({
          type: "rejected",
          code: err.code ?? "UNKNOWN",
          traceId: err.traceId ?? "",
          details,
          violations,
        });

        console.info("telemetry.jobs.generation.acknowledged.v1", {
          outcome: "rejected",
          rejectionCodes: violations.map((v) => v.code),
          clientAckLatencyMs: Date.now() - startedAt,
        });
        return;
      }

      if (!res.ok) {
        hadNetworkFailureSinceLastTerminalAckRef.current = false;
        clearIdempotency();
        setAck({
          type: "rejected",
          code: "UNEXPECTED_RESPONSE",
          traceId: "",
          violations: [],
        });
        return;
      }

      const data = envelope.data as { jobId: string; status: "queued" };
      hadNetworkFailureSinceLastTerminalAckRef.current = false;
      clearIdempotency();
      setAck({
        type: "accepted",
        jobId: data.jobId,
        status: data.status,
      });

      console.info("telemetry.jobs.generation.acknowledged.v1", {
        outcome: "accepted",
        jobId: data.jobId,
        status: data.status,
        clientAckLatencyMs: Date.now() - startedAt,
      });
    } catch (caught) {
      if (
        caught instanceof Error &&
        caught.message.includes("missing Firebase ID token")
      ) {
        hadNetworkFailureSinceLastTerminalAckRef.current = false;
        setAck({
          type: "rejected",
          code: "UNAUTHENTICATED",
          traceId: "",
          violations: [],
        });
      } else {
        hadNetworkFailureSinceLastTerminalAckRef.current = true;
        setAck({
          type: "rejected",
          code: abortController.signal.aborted ? "NETWORK_TIMEOUT" : "NETWORK_ERROR",
          traceId: "",
          violations: [],
        });
      }
    } finally {
      finishSubmittingUi();
    }
  }, [input, timeoutMs, clearIdempotency, onPendingIdempotencyKeyChange, getIdToken]);

  const acknowledgeDisclosure = React.useCallback(
    async (version: string): Promise<boolean> => {
      const res = await banyoneAuthenticatedFetch(
        `${API_BASE_URL}${DISCLOSURE_ACK_PATH}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ version }),
        },
        getIdToken,
      );
      const parsed = await parseBanyoneApiEnvelopeResponse(res);
      if (!parsed.ok) return false;
      return parsed.envelope.error === null;
    },
    [getIdToken],
  );

  return { isSubmittingJob, ack, submit, acknowledgeDisclosure };
}
