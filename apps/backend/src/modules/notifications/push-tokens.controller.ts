import { randomUUID } from 'crypto';

import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { BanyoneAuthUser } from '../auth/banyone-user.types';

import { PushTokensStore } from './push-tokens.store';

type PushTokenMutationEnvelope =
  | { data: { ok: true }; error: null }
  | {
      data: null;
      error: {
        code: string;
        message: string;
        retryable: boolean;
        traceId: string;
      };
    };

@UseGuards(FirebaseAuthGuard)
@Controller('v1')
export class PushTokensController {
  constructor(private readonly pushTokens: PushTokensStore) {}

  @Post('push-tokens')
  @HttpCode(200)
  register(
    @CurrentUser() user: BanyoneAuthUser,
    @Body() body: unknown,
  ): PushTokenMutationEnvelope {
    const token = extractFcmToken(body);
    if (!token) {
      return {
        data: null,
        error: {
          code: 'PUSH_TOKEN_INVALID',
          message: 'Request body must include a non-empty fcmToken string.',
          retryable: false,
          traceId: randomUUID(),
        },
      };
    }
    this.pushTokens.upsertToken(user.uid, token);
    return { data: { ok: true }, error: null };
  }

  /**
   * Deletes registration token(s). Omit `fcmToken` to clear all tokens for the user (sign-out).
   */
  @Delete('push-tokens')
  @HttpCode(200)
  unregister(
    @CurrentUser() user: BanyoneAuthUser,
    @Body() body: unknown,
  ): PushTokenMutationEnvelope {
    const token = extractOptionalFcmToken(body);
    this.pushTokens.removeToken(user.uid, token);
    return { data: { ok: true }, error: null };
  }
}

function extractFcmToken(body: unknown): string | null {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('fcmToken' in body) ||
    typeof (body as { fcmToken?: unknown }).fcmToken !== 'string'
  ) {
    return null;
  }
  const t = (body as { fcmToken: string }).fcmToken.trim();
  return t.length > 0 ? t : null;
}

function extractOptionalFcmToken(body: unknown): string | undefined {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('fcmToken' in body) ||
    (body as { fcmToken?: unknown }).fcmToken === undefined
  ) {
    return undefined;
  }
  const raw = (body as { fcmToken?: unknown }).fcmToken;
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}
