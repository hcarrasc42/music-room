import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, tap } from 'rxjs';
import { Repository } from 'typeorm';
import { ActionLog } from './action-log.entity.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(ActionLog)
    private readonly logs: Repository<ActionLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const action = `${req.method} ${req.path}`;
    const userId: string | undefined = req.user?.id;
    const platform: string = req.headers['x-platform'] ?? 'unknown';
    const deviceModel: string = req.headers['x-device'] ?? 'unknown';
    const appVersion: string = req.headers['x-app-version'] ?? 'unknown';

    return next.handle().pipe(
      tap(() => {
        this.logs
          .save({ userId, action, platform, deviceModel, appVersion })
          .catch(() => undefined);
      }),
    );
  }
}
