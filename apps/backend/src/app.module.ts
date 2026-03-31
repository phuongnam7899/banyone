import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { DisclosureModule } from './modules/disclosure/disclosure.module';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [AuthModule, DisclosureModule, JobsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
