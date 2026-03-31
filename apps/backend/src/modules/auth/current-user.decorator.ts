import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { BanyoneAuthUser } from './banyone-user.types';
import { BANYONE_USER_KEY } from './banyone-user.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BanyoneAuthUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const user = (req as Request & { [BANYONE_USER_KEY]?: BanyoneAuthUser })[
      BANYONE_USER_KEY
    ];
    if (!user?.uid) {
      throw new Error('CurrentUser used without FirebaseAuthGuard');
    }
    return user;
  },
);
