import { Global, Module } from '@nestjs/common';

import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseAuthService } from './firebase-auth.service';
import { ModeratorGuard } from './moderator.guard';
import { SupportGuard } from './support.guard';

@Global()
@Module({
  providers: [FirebaseAuthService, FirebaseAuthGuard, ModeratorGuard, SupportGuard],
  exports: [FirebaseAuthService, FirebaseAuthGuard, ModeratorGuard, SupportGuard],
})
export class AuthModule {}
