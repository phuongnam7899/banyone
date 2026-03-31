import {
  historyDetailHrefFromJobId,
  resolveHistoryDetailJobIdFromPushData,
} from "./resolve-history-detail-from-push-data";

describe("resolveHistoryDetailJobIdFromPushData", () => {
  it("returns jobId when present", () => {
    expect(
      resolveHistoryDetailJobIdFromPushData({
        jobId: "abc-123",
        kind: "job_ready",
      }),
    ).toBe("abc-123");
  });

  it("parses job id from deepLink", () => {
    expect(
      resolveHistoryDetailJobIdFromPushData({
        deepLink: "mobile:///history-detail/abc-123",
        kind: "job_failed",
      }),
    ).toBe("abc-123");
  });

  it("decodes URI-encoded ids in deepLink path", () => {
    expect(
      resolveHistoryDetailJobIdFromPushData({
        deepLink: "mobile:///history-detail/hello%20world",
      }),
    ).toBe("hello world");
  });

  it("returns null when nothing usable", () => {
    expect(resolveHistoryDetailJobIdFromPushData({})).toBeNull();
    expect(resolveHistoryDetailJobIdFromPushData(undefined)).toBeNull();
  });
});

describe("historyDetailHrefFromJobId", () => {
  it("builds expo-router href", () => {
    expect(historyDetailHrefFromJobId("j1")).toBe("/history-detail/j1");
  });
});
