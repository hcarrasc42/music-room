import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Event } from '../events/entities/event.entity.js';
import { QueueService } from '../queue/queue.service.js';
import { SpotifyService } from '../spotify/spotify.service.js';
import { EventsGateway } from './events.gateway.js';

@Controller('events/:id/player')
@UseGuards(JwtGuard)
export class PlayerController {
  constructor(
    @InjectRepository(Event) private events: Repository<Event>,
    private spotify: SpotifyService,
    private queue: QueueService,
    private gateway: EventsGateway,
  ) {}

  private async assertOwner(userId: string, eventId: string) {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException('Event not found');
    if (event.ownerId !== userId) throw new ForbiddenException('Only the event owner can control playback');
  }

  @Get()
  async getPlayer(@Param('id') id: string) {
    const [spotifyState, current] = await Promise.all([
      this.spotify.getPlayer(),
      this.queue.getCurrentPlaying(id),
    ]);
    return { spotifyState, currentSuggestion: current };
  }

  @Post('pause')
  async pause(@CurrentUser() u: { id: string }, @Param('id') id: string) {
    await this.assertOwner(u.id, id);
    await this.spotify.pause().catch(() => {});
    return { ok: true };
  }

  @Post('resume')
  async resume(@CurrentUser() u: { id: string }, @Param('id') id: string) {
    await this.assertOwner(u.id, id);
    await this.spotify.resume().catch(() => {});
    return { ok: true };
  }

  @Post('seek')
  async seek(@CurrentUser() u: { id: string }, @Param('id') id: string, @Body('positionMs') positionMs: number) {
    await this.assertOwner(u.id, id);
    await this.spotify.seek(positionMs).catch(() => {});
    return { ok: true };
  }

  @Post('next')
  async next(@CurrentUser() u: { id: string }, @Param('id') id: string) {
    await this.assertOwner(u.id, id);
    const current = await this.queue.getCurrentPlaying(id);
    if (current) await this.queue.markPlayed(current.id);
    const next = await this.queue.getTopQueued(id);
    if (!next) {
      await this.spotify.next().catch(() => {});
      await this.gateway.emitQueueUpdate(id);
      return { playing: true };
    }
    await this.queue.markPlaying(next.id);
    await this.spotify.play(next.spotifyUri).catch(() => {});
    await this.gateway.emitQueueUpdate(id);
    return { playing: true, track: { trackName: next.trackName, artist: next.artist, albumArt: next.albumArt } };
  }

  @Post('previous')
  async previous(@CurrentUser() u: { id: string }, @Param('id') id: string) {
    await this.assertOwner(u.id, id);
    await this.spotify.previous().catch(() => {});
    return { ok: true };
  }
}
