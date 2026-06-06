import {
  ABUSE_RESTRICTION_ACTIVE_ERROR_CODE,
  API_RATE_LIMIT_ERROR_CODE,
  DEFAULT_QUALITY_TIER,
  INSUFFICIENT_CREDIT_ERROR_CODE,
  POLICY_VIOLATION_ERROR_CODE,
  isApiRateLimitDetails,
  isInsufficientCreditDetails,
  isJobPolicyViolationDetails,
} from "@banyone/contracts";
import React from "react";
import { Platform } from "react-native";

import { useBanyoneAuth } from "@/features/auth/auth-context";
import type { CreateGenerationJobRequestBody } from "@/features/create-job/types/create-generation-job";
import { banyoneAuthenticatedFetch } from "@/infra/api-client/authenticated-fetch";
import { parseBanyoneApiEnvelopeResponse } from "@/infra/api-client/parse-json-envelope";
import { emitCreateJobDraftTelemetry, emitFunnelTelemetry } from "@/infra/telemetry";

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

type SubmitPolicyBlockedAck = {
  type: "policy-blocked";
  policyCode: string;
  message: string;
  guidance: string;
  traceId: string;
};

type SubmitAbuseRestrictedAck = {
  type: "abuse-restricted";
  message: string;
  traceId: string;
};

type SubmitInsufficientCreditAck = {
  type: "insufficient-credit";
  message: string;
  traceId: string;
  balance: number;
  required: number;
  shortfall: number;
  videoCreditPerSecond: number;
};

type SubmitAck =
  | SubmitAcceptedAck
  | SubmitRejectedAck
  | SubmitRateLimitedAck
  | SubmitDisclosureRequiredAck
  | SubmitPolicyBlockedAck
  | SubmitAbuseRestrictedAck
  | SubmitInsufficientCreditAck;

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
const ASSET_UPLOAD_PATH = "/v1/generation-jobs/assets";
const DISCLOSURE_ACK_PATH = "/v1/synthetic-media-disclosure/acknowledge";
const MEDIA_UPLOAD_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_MEDIA_UPLOAD === "true";
const DISCLOSURE_REQUIRED_ERROR_CODE = "DISCLOSURE_REQUIRED";

const POLICY_BLOCKED_GUIDANCE: Record<string, string> = {
  STORAGE_URI_BLOCKED:
    "Choose a different video or image file. If this keeps happening, contact support and share the trace ID below.",
};

function policyGuidanceForCode(policyCode: string): string {
  return POLICY_BLOCKED_GUIDANCE[policyCode] ?? POLICY_BLOCKED_GUIDANCE.STORAGE_URI_BLOCKED;
}

function generateIdempotencyKey(): string {
  return `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

/** React Native native multipart file shape (not supported in browser FormData). */
function appendNativeUploadFilePart(
  formData: FormData,
  uri: string,
  fileName: string,
  mimeType: string,
): void {
  formData.append("file", {
    uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
}

/** Web: read picker URI (e.g. blob:) into a Blob so Multer receives real bytes. */
async function appendWebUploadFilePart(
  formData: FormData,
  uri: string,
  fileName: string,
  mimeType: string,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(uri, { signal });
  if (!res.ok) {
    throw new Error("ASSET_UPLOAD_FAILED");
  }
  const raw = await res.blob();
  const body =
    mimeType.trim().length > 0 ? new Blob([raw], { type: mimeType }) : raw;
  formData.append("file", body, fileName);
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

    const hadNetworkFailure = hadNetworkFailureSinceLastTerminalAckRef.current;
    const existingKey = idempotencyKeyRef.current;
    const idempotencyKey = existingKey ?? generateIdempotencyKey();
    idempotencyKeyRef.current = idempotencyKey;
    if (!existingKey) {
      onPendingIdempotencyKeyChange?.(idempotencyKey);
    } else if (hadNetworkFailure) {
      emitCreateJobDraftTelemetry({
        event: "create_job_submit_retry_after_failure",
        funnelStage: "submit_result",
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
      const uploadIfNeeded = async (
        slot: "video" | "image",
        uri: string | null,
        mimeType: string | null,
      ): Promise<string | null> => {
        if (!uri) return null;
        if (/^https?:\/\//i.test(uri)) return uri;
        if (!MEDIA_UPLOAD_ENABLED) return uri;
        const fileName = uri.split("/").pop() ?? `${slot}-${Date.now()}`;
        const resolvedMime =
          mimeType?.trim() && mimeType.includes("/")
            ? mimeType.trim()
            : slot === "video"
              ? "video/mp4"
              : "image/jpeg";
        const formData = new FormData();
        formData.append("slot", slot);
        if (Platform.OS === "web") {
          await appendWebUploadFilePart(
            formData,
            uri,
            fileName,
            resolvedMime,
            abortController.signal,
          );
        } else {
          appendNativeUploadFilePart(formData, uri, fileName, resolvedMime);
        }
        const uploadRes = await banyoneAuthenticatedFetch(
          `${API_BASE_URL}${ASSET_UPLOAD_PATH}`,
          {
            method: "POST",
            body: formData,
            signal: abortController.signal,
          },
          getIdToken,
        );
        const uploaded = await parseBanyoneApiEnvelopeResponse(uploadRes);
        if (!uploaded.ok || uploaded.envelope.error !== null || !uploadRes.ok) {
          throw new Error("ASSET_UPLOAD_FAILED");
        }
        const payload = uploaded.envelope.data as { assetUrl: string };
        return payload.assetUrl;
      };
      const uploadedVideoUri = await uploadIfNeeded(
        "video",
        input.video.uri,
        input.video.mimeType,
      );
      const uploadedImageUri = await uploadIfNeeded(
        "image",
        input.image.uri,
        input.image.mimeType,
      );
      const requestBody: CreateGenerationJobRequestBody = {
        ...input,
        video: {
          ...input.video,
          uri: uploadedVideoUri,
        },
        image: {
          ...input.image,
          uri: uploadedImageUri,
        },
      };
      const res = await banyoneAuthenticatedFetch(
        `${API_BASE_URL}${ENDPOINT_PATH}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-banyone-idempotency-key": idempotencyKey,
          },
          body: JSON.stringify(requestBody),
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
          emitFunnelTelemetry({
            funnelStage: "submit_result",
            submissionOutcomeClass: "rate_limited",
            eventName: "submit_result",
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
          emitFunnelTelemetry({
            funnelStage: "disclosure_presented",
            submissionOutcomeClass: "disclosure_required",
            eventName: "disclosure_presented",
          });
          return;
        }

        if (err.code === POLICY_VIOLATION_ERROR_CODE) {
          const details = isJobPolicyViolationDetails(err.details) ? err.details : null;
          const policyCode = details?.policyCode ?? "STORAGE_URI_BLOCKED";
          setAck({
            type: "policy-blocked",
            policyCode,
            message: err.message,
            guidance: policyGuidanceForCode(policyCode),
            traceId: err.traceId ?? "",
          });
          emitFunnelTelemetry({
            funnelStage: "submit_result",
            submissionOutcomeClass: "policy_blocked",
            eventName: "submit_result",
            code: policyCode,
          });
          return;
        }

        if (err.code === ABUSE_RESTRICTION_ACTIVE_ERROR_CODE) {
          setAck({
            type: "abuse-restricted",
            message: err.message,
            traceId: err.traceId ?? "",
          });
          emitFunnelTelemetry({
            funnelStage: "submit_result",
            submissionOutcomeClass: "abuse_restricted",
            eventName: "submit_result",
          });
          return;
        }

        if (
          err.code === INSUFFICIENT_CREDIT_ERROR_CODE ||
          err.code === "INSUFFICIENT_CREDIT"
        ) {
          const details = isInsufficientCreditDetails(err.details)
            ? err.details
            : null;
          setAck({
            type: "insufficient-credit",
            message: err.message,
            traceId: err.traceId ?? "",
            balance: details?.balance ?? 0,
            required: details?.required ?? 0,
            shortfall: details?.shortfall ?? 0,
            videoCreditPerSecond: details?.videoCreditPerSecond ?? 0,
          });
          emitFunnelTelemetry({
            funnelStage: "submit_result",
            submissionOutcomeClass: "validation_rejected",
            eventName: "submit_result",
            code: INSUFFICIENT_CREDIT_ERROR_CODE,
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

        emitFunnelTelemetry({
          funnelStage: "submit_result",
          submissionOutcomeClass: "validation_rejected",
          eventName: "submit_result",
          code: violations[0]?.code,
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
      emitFunnelTelemetry({
        funnelStage: "submit_result",
        submissionOutcomeClass: "accepted",
        terminalJobStatusClass: "queued",
        eventName: "submit_result",
        jobId: data.jobId,
        qualityTier: requestBody.qualityTier ?? DEFAULT_QUALITY_TIER,
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
        emitFunnelTelemetry({
          funnelStage: "submit_result",
          submissionOutcomeClass: "validation_rejected",
          eventName: "submit_result",
          code: "UNAUTHENTICATED",
        });
      } else {
        hadNetworkFailureSinceLastTerminalAckRef.current = true;
        setAck({
          type: "rejected",
          code: abortController.signal.aborted ? "NETWORK_TIMEOUT" : "NETWORK_ERROR",
          traceId: "",
          violations: [],
        });
        emitFunnelTelemetry({
          funnelStage: "submit_result",
          submissionOutcomeClass: "network_error",
          eventName: "submit_result",
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
      if (parsed.envelope.error === null) {
        emitFunnelTelemetry({
          funnelStage: "disclosure_acknowledged",
          eventName: "disclosure_acknowledged",
        });
        return true;
      }
      return false;
    },
    [getIdToken],
  );

  return { isSubmittingJob, ack, submit, acknowledgeDisclosure };
}
