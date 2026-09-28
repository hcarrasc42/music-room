import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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

  @Post('play')
  play(@Body() body: { uri?: string }) {
    return body.uri ? this.spotify.play(body.uri) : this.spotify.resume();
  }

  @Post('pause')
  pause() {
    return this.spotify.pause();
  }

  @Post('next')
  next() {
    return this.spotify.next();
  }

  @Post('previous')
  previous() {
    return this.spotify.previous();
  }

  @Post('seek')
  seek(@Body() body: { positionMs: number }) {
    return this.spotify.seek(body.positionMs);
  }
}
