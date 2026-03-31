import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { SyntheticMediaDisclosureController } from './synthetic-media-disclosure.controller';
import { SyntheticMediaDisclosureStore } from './synthetic-media-disclosure.store';

@Module({
  imports: [AuthModule],
  controllers: [SyntheticMediaDisclosureController],
  providers: [SyntheticMediaDisclosureStore],
  exports: [SyntheticMediaDisclosureStore],
})
export class DisclosureModule {}
