import './load-backend-env';
import { resolve } from 'node:path';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ThrottlerEnvelopeExceptionFilter } from './modules/auth/throttler-envelope.filter';

function getAllowedOrigins(): string[] {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (configuredOrigins) {
    return configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return ['http://localhost:8081', 'http://localhost:19006'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  const usesFirebaseStorage = Boolean(
    process.env.FIREBASE_STORAGE_BUCKET?.trim(),
  );
  if (!usesFirebaseStorage) {
    const mediaRoot =
      process.env.BANYONE_MEDIA_ASSETS_DIR?.trim() ||
      resolve(process.cwd(), '.banyone-media-assets');
    app.use('/v1/media', express.static(mediaRoot));
  }
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigins = getAllowedOrigins();

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-banyone-idempotency-key',
    ],
  });
  app.useGlobalFilters(new ThrottlerEnvelopeExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((err: unknown) => {
  console.error('Nest bootstrap failed', err);
  process.exit(1);
});
