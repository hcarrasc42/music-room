import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SpotifyController } from './spotify.controller.js';
import { SpotifyService } from './spotify.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SpotifyController],
  providers: [SpotifyService],
  exports: [SpotifyService],
})
export class SpotifyModule {}
