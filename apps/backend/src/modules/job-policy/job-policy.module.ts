import { Module } from '@nestjs/common';

import { JobPolicyScreeningService } from './job-policy-screening.service';

@Module({
  providers: [JobPolicyScreeningService],
  exports: [JobPolicyScreeningService],
})
export class JobPolicyModule {}
