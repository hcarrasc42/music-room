import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// ThrottlerGuard global solo para HTTP: en los mensajes de WebSocket (join/leave)
// intenta poner cabeceras de respuesta que no existen y rompe el gateway
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return context.getType() !== 'http' || super.shouldSkip(context);
  }
}
