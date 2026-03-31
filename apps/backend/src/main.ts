import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ThrottlerEnvelopeExceptionFilter } from './modules/auth/throttler-envelope.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ThrottlerEnvelopeExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((err: unknown) => {
  console.error('Nest bootstrap failed', err);
  process.exit(1);
});
