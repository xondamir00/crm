import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppLogger } from './common/logger/app.logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const logger = new AppLogger();
  app.useLogger(logger);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  logger.log(`Server running at http://localhost:${port}`);
}

bootstrap();
