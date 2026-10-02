import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpThrottlerGuard } from './common/http-throttler.guard.js';
import { LogsModule } from './common/logs.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { EventsModule } from './events/events.module.js';
import { GatewayModule } from './gateway/gateway.module.js';
import { QueueModule } from './queue/queue.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('POSTGRES_HOST', 'localhost'),
        port: parseInt(cfg.getOrThrow('POSTGRES_PORT'), 10),
        username: cfg.getOrThrow('POSTGRES_USER'),
        password: cfg.getOrThrow('POSTGRES_PASSWORD'),
        database: cfg.getOrThrow('POSTGRES_DB'),
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production',
      }),
    }),
    // Límite general por IP; la app consulta el reproductor cada 2 s (30/min), así que
    // hay margen de sobra. Los endpoints de auth tienen límites propios más bajos
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      errorMessage: 'Demasiadas peticiones seguidas. Espera un minuto y vuelve a intentarlo',
    }),
    LogsModule,
    AuthModule,
    UsersModule,
    EventsModule,
    QueueModule,
    GatewayModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: HttpThrottlerGuard }],
})
export class AppModule {}
