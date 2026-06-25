import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  const port = Number(process.env.PORT ?? 7001);
  await app.listen(port);
  console.log(`Lokumu API listening on http://localhost:${port}`);
}
bootstrap();
