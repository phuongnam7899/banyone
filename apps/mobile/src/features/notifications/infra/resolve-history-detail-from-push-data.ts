/**
 * FCM delivers `data` as string key/values. This helper resolves the job id
 * for routing to `history-detail/[id]`.
 */
export function resolveHistoryDetailJobIdFromPushData(
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data) return null;
  const jobId = data.jobId;
  if (typeof jobId === 'string' && jobId.trim().length > 0) {
    return jobId.trim();
  }
  const deepLink = data.deepLink;
  if (typeof deepLink === 'string' && deepLink.trim().length > 0) {
    const m = /history-detail\/([^/?#]+)/.exec(deepLink);
    if (m?.[1]) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return m[1];
      }
    }
  }
  return null;
}

export function historyDetailHrefFromJobId(jobId: string): string {
  return `/history-detail/${jobId}`;
}
