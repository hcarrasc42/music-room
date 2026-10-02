import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    cfg: ConfigService,
    @InjectRepository(User) private users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: cfg.getOrThrow('JWT_SECRET'),
    });
  }

  // Además de la firma, comprueba que la cuenta sigue existiendo y que la sesión
  // no se ha cerrado desde otro dispositivo (logout-all o cambio de contraseña)
  async validate(payload: { sub: string; email: string; iat: number }) {
    const user = await this.users.findOne({
      where: { id: payload.sub },
      select: { id: true, email: true, sessionsValidAfter: true },
    });
    if (!user) throw new UnauthorizedException('La cuenta ya no existe');
    if (user.sessionsValidAfter && payload.iat < Math.floor(user.sessionsValidAfter.getTime() / 1000)) {
      throw new UnauthorizedException('La sesión se ha cerrado. Vuelve a iniciar sesión');
    }
    return { id: user.id, email: user.email };
  }
}
