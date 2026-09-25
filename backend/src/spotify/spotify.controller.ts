import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { SpotifyService } from './spotify.service.js';

@Controller('spotify')
@UseGuards(JwtGuard)
export class SpotifyController {
  constructor(private spotify: SpotifyService) {}

  @Get('search')
  search(@Query('q') q: string) {
    if (!q?.trim()) return [];
    return this.spotify.search(q.trim());
  }

  @Get('player')
  player() {
    return this.spotify.getPlayer();
  }
}
