export type BanyoneApiErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
  traceId?: string;
  details?: unknown;
};

export type BanyoneApiEnvelope =
  | { data: unknown; error: null }
  | { data: null; error: BanyoneApiErrorBody };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function isBanyoneApiEnvelope(value: unknown): value is BanyoneApiEnvelope {
  if (!isRecord(value)) return false;
  if (!('data' in value) || !('error' in value)) return false;
  const { data, error } = value;
  if (error === null) return data !== null && data !== undefined;
  if (data !== null) return false;
  return isRecord(error) && typeof (error as BanyoneApiErrorBody).code === 'string';
}

export async function parseBanyoneApiEnvelopeResponse(
  res: Response,
): Promise<
  | { ok: true; envelope: BanyoneApiEnvelope }
  | { ok: false; kind: 'not_json' | 'invalid_envelope' }
> {
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, kind: 'not_json' };
  }
  if (!isBanyoneApiEnvelope(parsed)) {
    return { ok: false, kind: 'invalid_envelope' };
  }
  return { ok: true, envelope: parsed };
}
