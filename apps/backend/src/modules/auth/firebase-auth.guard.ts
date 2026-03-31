import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID } from 'crypto';

import type { ApiAuthErrorCode } from '@banyone/contracts';

import { FirebaseAuthService } from './firebase-auth.service';
import type { BanyoneAuthUser } from './banyone-user.types';
import { BANYONE_USER_KEY } from './banyone-user.types';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebaseAuth: FirebaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers.authorization;

    try {
      const { uid } =
        await this.firebaseAuth.verifyBearerAuthorizationHeader(authHeader);
      (req as Request & { [BANYONE_USER_KEY]: BanyoneAuthUser })[
        BANYONE_USER_KEY
      ] = { uid };
      return true;
    } catch (err: unknown) {
      const code =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof (err as { code: unknown }).code === 'string'
          ? ((err as { code: string }).code as ApiAuthErrorCode)
          : 'UNAUTHENTICATED';

      const message =
        err instanceof Error ? err.message : 'Authentication required.';

      throw new HttpException(
        {
          data: null,
          error: {
            code,
            message,
            retryable: false,
            traceId: randomUUID(),
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
