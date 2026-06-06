export function resolveBanyoneCreditConfig(): {
  videoCreditPerSecond: number;
  defaultUserCredits: number;
} {
  const rawRate = Number(process.env.BANYONE_VIDEO_CREDIT_PER_SECOND ?? '');
  const videoCreditPerSecond =
    Number.isFinite(rawRate) && rawRate >= 1 ? Math.ceil(rawRate) : 100;

  const rawDefault = Number(process.env.BANYONE_DEFAULT_USER_CREDITS ?? '');
  const defaultUserCredits =
    Number.isFinite(rawDefault) && rawDefault >= 0 ? Math.floor(rawDefault) : 0;

  return { videoCreditPerSecond, defaultUserCredits };
}
