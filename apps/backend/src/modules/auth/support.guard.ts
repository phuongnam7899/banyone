import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { SUPPORT_DIAGNOSTICS_FORBIDDEN_ERROR_CODE } from '@banyone/contracts';

import type { BanyoneAuthUser } from './banyone-user.types';
import { BANYONE_USER_KEY } from './banyone-user.types';

@Injectable()
export class SupportGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as Request & { [BANYONE_USER_KEY]?: BanyoneAuthUser })[
      BANYONE_USER_KEY
    ];

    if (user?.isSupport || user?.isModerator) {
      return true;
    }

    throw new HttpException(
      {
        data: null,
        error: {
          code: SUPPORT_DIAGNOSTICS_FORBIDDEN_ERROR_CODE,
          message: 'Support privileges are required for this operation.',
          retryable: false,
          traceId: randomUUID(),
        },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
