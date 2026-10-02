import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionLog } from './action-log.entity.js';
import { LoggingInterceptor } from './logging.interceptor.js';

@Module({
  imports: [TypeOrmModule.forFeature([ActionLog])],
  providers: [{ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }],
})
export class LogsModule {}
