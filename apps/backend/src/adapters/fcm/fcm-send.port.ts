export type FcmOutMessage = {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

export interface FcmSendPort {
  sendToDevice(message: FcmOutMessage): Promise<void>;
}

/** Nest injection token */
export const FCM_SEND_PORT = 'BANYONE_FCM_SEND_PORT';
