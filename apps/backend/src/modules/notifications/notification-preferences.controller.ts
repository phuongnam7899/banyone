import { randomUUID } from 'crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { NotificationPreferences } from '@banyone/contracts';

import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { BanyoneAuthUser } from '../auth/banyone-user.types';

import { NotificationPreferencesStore } from './notification-preferences.store';

type NotificationPreferencesEnvelope =
  | { data: { preferences: NotificationPreferences }; error: null }
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
export class NotificationPreferencesController {
  constructor(private readonly preferences: NotificationPreferencesStore) {}

  @Get('notification-preferences')
  @HttpCode(200)
  getPreferences(
    @CurrentUser() user: BanyoneAuthUser,
  ): NotificationPreferencesEnvelope {
    return { data: { preferences: this.preferences.getForUser(user.uid) }, error: null };
  }

  @Put('notification-preferences')
  @HttpCode(200)
  updatePreferences(
    @CurrentUser() user: BanyoneAuthUser,
    @Body() body: unknown,
  ): NotificationPreferencesEnvelope {
    const parsed = parsePreferencesBody(body);
    if (!parsed) {
      return {
        data: null,
        error: {
          code: 'NOTIFICATION_PREFERENCES_INVALID',
          message:
            'Request body must provide lifecycle preference booleans: jobQueued, jobReady, jobFailed.',
          retryable: false,
          traceId: randomUUID(),
        },
      };
    }

    return {
      data: { preferences: this.preferences.updateForUser(user.uid, parsed) },
      error: null,
    };
  }
}

function parsePreferencesBody(body: unknown): NotificationPreferences | null {
  if (typeof body !== 'object' || body === null || !('lifecycle' in body)) return null;
  const lifecycle = (body as { lifecycle?: unknown }).lifecycle;
  if (typeof lifecycle !== 'object' || lifecycle === null) return null;
  const jobQueued = (lifecycle as { jobQueued?: unknown }).jobQueued;
  const jobReady = (lifecycle as { jobReady?: unknown }).jobReady;
  const jobFailed = (lifecycle as { jobFailed?: unknown }).jobFailed;
  if (
    typeof jobQueued !== 'boolean' ||
    typeof jobReady !== 'boolean' ||
    typeof jobFailed !== 'boolean'
  ) {
    return null;
  }
  return { lifecycle: { jobQueued, jobReady, jobFailed } };
}
