import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SkipThrottle } from '@nestjs/throttler';
import {
  isAbuseSubjectType,
  type AbuseRestrictionEnvelope,
  type AbuseRestrictionMutationEnvelope,
} from '@banyone/contracts';

import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ModeratorGuard } from '../auth/moderator.guard';
import type { BanyoneAuthUser } from '../auth/banyone-user.types';
import { AbuseService } from './abuse.service';

@UseGuards(FirebaseAuthGuard, ModeratorGuard)
@SkipThrottle({ default: true })
@Controller('v1/moderation/abuse-restrictions')
export class AbuseController {
  constructor(private readonly abuseService: AbuseService) {}

  @Get()
  async getRestriction(
    @Query('subjectType') subjectType: string | undefined,
    @Query('subjectId') subjectId: string | undefined,
  ): Promise<AbuseRestrictionEnvelope> {
    if (!isAbuseSubjectType(subjectType) || !subjectId?.trim()) {
      return {
        data: null,
        error: {
          code: 'ABUSE_RESTRICTION_INVALID',
          message: 'subjectType and subjectId are required.',
          retryable: false,
          traceId: randomUUID(),
        },
      };
    }
    return {
      data: {
        restriction: await this.abuseService.getActiveRestriction({
          subjectType,
          subjectId: subjectId.trim(),
        }),
      },
      error: null,
    };
  }

  @Post()
  @SkipThrottle({ default: false })
  async applyRestriction(
    @CurrentUser() user: BanyoneAuthUser,
    @Body() body: unknown,
  ): Promise<AbuseRestrictionMutationEnvelope> {
    if (typeof body !== 'object' || body === null) {
      return {
        data: null,
        error: {
          code: 'ABUSE_RESTRICTION_INVALID',
          message: 'Invalid restriction payload.',
          retryable: false,
          traceId: randomUUID(),
        },
      };
    }
    const b = body as {
      subjectType?: unknown;
      subjectId?: unknown;
      reason?: unknown;
      expiresAt?: unknown;
    };
    if (
      !isAbuseSubjectType(b.subjectType) ||
      typeof b.subjectId !== 'string' ||
      typeof b.reason !== 'string' ||
      (b.expiresAt !== undefined && typeof b.expiresAt !== 'string')
    ) {
      return {
        data: null,
        error: {
          code: 'ABUSE_RESTRICTION_INVALID',
          message: 'Invalid restriction payload.',
          retryable: false,
          traceId: randomUUID(),
        },
      };
    }
    return this.abuseService.applyManualRestriction({
      actorUserId: user.uid,
      subjectType: b.subjectType,
      subjectId: b.subjectId,
      reason: b.reason,
      ...(b.expiresAt ? { expiresAt: b.expiresAt } : {}),
    });
  }

  @Post('clear')
  @SkipThrottle({ default: false })
  async clearRestriction(
    @CurrentUser() user: BanyoneAuthUser,
    @Body() body: unknown,
  ): Promise<AbuseRestrictionMutationEnvelope> {
    if (typeof body !== 'object' || body === null) {
      return {
        data: null,
        error: {
          code: 'ABUSE_RESTRICTION_INVALID',
          message: 'Invalid restriction payload.',
          retryable: false,
          traceId: randomUUID(),
        },
      };
    }
    const b = body as {
      subjectType?: unknown;
      subjectId?: unknown;
      reason?: unknown;
    };
    if (
      !isAbuseSubjectType(b.subjectType) ||
      typeof b.subjectId !== 'string' ||
      (b.reason !== undefined && typeof b.reason !== 'string')
    ) {
      return {
        data: null,
        error: {
          code: 'ABUSE_RESTRICTION_INVALID',
          message: 'Invalid restriction payload.',
          retryable: false,
          traceId: randomUUID(),
        },
      };
    }
    return this.abuseService.clearManualRestriction({
      actorUserId: user.uid,
      subjectType: b.subjectType,
      subjectId: b.subjectId,
      ...(b.reason ? { reason: b.reason } : {}),
    });
  }
}
