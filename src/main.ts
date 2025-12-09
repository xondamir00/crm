import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppLogger } from './common/logger/app.logger';
import cookieParser from 'cookie-parser';

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
  app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  const logger = new AppLogger();
  app.use(cookieParser());
  app.useLogger(logger);
  app.enableCors({
    origin: 'http://localhost:5173', // front URL
    credentials: true, //cookie uchun majburiy
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  logger.log(`Server running at http://localhost:${port}`);
}

bootstrap();
