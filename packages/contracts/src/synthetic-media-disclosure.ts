export const DISCLOSURE_REQUIRED_ERROR_CODE = 'DISCLOSURE_REQUIRED' as const;

export type DisclosureRequiredErrorCode = typeof DISCLOSURE_REQUIRED_ERROR_CODE;

export type SyntheticMediaDisclosureAcceptance = {
  acceptedAt: string;
  version: string;
};

export type SyntheticMediaDisclosureStatus = {
  accepted: boolean;
  currentVersion: string;
  acceptance: SyntheticMediaDisclosureAcceptance | null;
};

export type RecordSyntheticMediaDisclosureRequest = {
  version: string;
};
