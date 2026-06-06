import { Module } from '@nestjs/common';
import { FirestoreModule } from './infra/firestore.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AbuseModule } from './modules/abuse/abuse.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { DisclosureModule } from './modules/disclosure/disclosure.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { SupportModule } from './modules/support/support.module';

@Module({
  imports: [
    FirestoreModule,
    AuthModule,
    DisclosureModule,
    JobsModule,
    ModerationModule,
    AbuseModule,
    SupportModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
