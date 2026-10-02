import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, tap } from 'rxjs';
import { Repository } from 'typeorm';
import { ActionLog } from './action-log.entity.js';

// Guarda en action_logs cada petición HTTP de la app: quién, qué, desde qué
// plataforma/dispositivo/versión y cómo terminó (V.6 del subject)
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(ActionLog)
    private readonly logs: Repository<ActionLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const header = (name: string) => String(req.headers[name] ?? 'unknown').slice(0, 100);
    const base = {
      action: `${req.method} ${req.route?.path ?? req.path}`,
      platform: header('x-platform'),
      deviceModel: header('x-device'),
      appVersion: header('x-app-version'),
      ip: req.ip ?? null,
    };
    // req.user lo rellena el JwtGuard, que se ejecuta antes que los interceptores
    const save = (statusCode: number) =>
      void this.logs.save({ ...base, userId: req.user?.id ?? null, statusCode }).catch(() => undefined);

    return next.handle().pipe(
      tap({
        next: () => save(res.statusCode),
        error: (err) => save(err instanceof HttpException ? err.getStatus() : 500),
      }),
    );
  }
}
