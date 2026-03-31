import { randomUUID } from 'crypto';
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import type {
  RecordSyntheticMediaDisclosureRequest,
  SyntheticMediaDisclosureStatus,
} from '@banyone/contracts';

import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { BanyoneAuthUser } from '../auth/banyone-user.types';

import { SyntheticMediaDisclosureStore } from './synthetic-media-disclosure.store';

type DisclosureStatusEnvelope =
  | { data: SyntheticMediaDisclosureStatus; error: null }
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
export class SyntheticMediaDisclosureController {
  constructor(private readonly disclosure: SyntheticMediaDisclosureStore) {}

  @Get('synthetic-media-disclosure')
  @HttpCode(200)
  getStatus(@CurrentUser() user: BanyoneAuthUser): DisclosureStatusEnvelope {
    const acceptance = this.disclosure.getAcceptanceForUser(user.uid);
    return {
      data: {
        accepted: this.disclosure.isAcceptedForUser(user.uid),
        currentVersion: this.disclosure.getCurrentVersion(),
        acceptance,
      },
      error: null,
    };
  }

  @Post('synthetic-media-disclosure/acknowledge')
  @HttpCode(200)
  acknowledge(
    @CurrentUser() user: BanyoneAuthUser,
    @Body() body: unknown,
  ): DisclosureStatusEnvelope {
    const parsed = parseBody(body);
    const currentVersion = this.disclosure.getCurrentVersion();
    if (!parsed || parsed.version !== currentVersion) {
      return {
        data: null,
        error: {
          code: 'DISCLOSURE_VERSION_INVALID',
          message: `Disclosure version must equal ${currentVersion}.`,
          retryable: false,
          traceId: randomUUID(),
        },
      };
    }

    const acceptance = this.disclosure.recordAcceptanceForUser({
      userId: user.uid,
      version: parsed.version,
    });

    return {
      data: {
        accepted: true,
        currentVersion,
        acceptance,
      },
      error: null,
    };
  }
}

function parseBody(body: unknown): RecordSyntheticMediaDisclosureRequest | null {
  if (typeof body !== 'object' || body === null || !('version' in body)) return null;
  const version = (body as { version?: unknown }).version;
  if (typeof version !== 'string' || version.trim().length === 0) return null;
  return { version: version.trim() };
}
