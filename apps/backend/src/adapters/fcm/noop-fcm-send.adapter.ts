import type { FcmOutMessage, FcmSendPort } from './fcm-send.port';

export class NoopFcmSendAdapter implements FcmSendPort {
  sendToDevice(message: FcmOutMessage): Promise<void> {
    void message;
    return Promise.resolve();
  }
}
