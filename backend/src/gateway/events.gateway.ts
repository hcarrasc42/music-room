import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../events/entities/event.entity.js';
import { QueueService } from '../queue/queue.service.js';
import { SpotifyService } from '../spotify/spotify.service.js';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class EventsGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger('SpotifyGateway');
  private pollingIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private advancing = new Set<string>();

  constructor(
    @InjectRepository(Event) private events: Repository<Event>,
    private queue: QueueService,
    private spotify: SpotifyService,
  ) {}

  onModuleInit() {
    this.startPollingAll();
  }

  onModuleDestroy() {
    for (const interval of this.pollingIntervals.values()) clearInterval(interval);
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, eventId: string) {
    client.join(`event:${eventId}`);
  }

  @SubscribeMessage('leave')
  handleLeave(client: Socket, eventId: string) {
    client.leave(`event:${eventId}`);
  }

  async emitQueueUpdate(eventId: string) {
    const queue = await this.queue.getSuggestions(eventId);
    this.server.to(`event:${eventId}`).emit('queue:updated', queue);
  }

  private async startPollingAll() {
    const activeEvents = await this.events.find({ where: { isActive: true } });
    for (const event of activeEvents) {
      this.startPolling(event.id);
    }
  }

  startPolling(eventId: string) {
    if (this.pollingIntervals.has(eventId)) return;
    const interval = setInterval(() => this.pollSpotify(eventId), 3000);
    this.pollingIntervals.set(eventId, interval);
  }

  stopPolling(eventId: string) {
    const interval = this.pollingIntervals.get(eventId);
    if (interval) { clearInterval(interval); this.pollingIntervals.delete(eventId); }
  }

  private async pollSpotify(eventId: string) {
    try {
      const player = await this.spotify.getPlayer();
      if (!player) { this.logger.debug(`[${eventId.slice(0,8)}] no active device (204)`); return; }
      if (!player.isPlaying) { this.logger.debug(`[${eventId.slice(0,8)}] paused`); return; }
      if (!player.durationMs) return;

      const ratio = player.progressMs / player.durationMs;
      this.logger.debug(`[${eventId.slice(0,8)}] progress ${Math.round(ratio * 100)}%`);
      if (ratio < 0.95) return;

      if (this.advancing.has(eventId)) return;
      this.advancing.add(eventId);

      const next = await this.queue.getTopQueued(eventId);
      if (!next) {
        await this.spotify.pause();
        this.server.to(`event:${eventId}`).emit('queue:empty');
        await this.emitQueueUpdate(eventId);
        return;
      }

      const currentPlaying = await this.queue.getCurrentPlaying(eventId);
      if (currentPlaying) {
        await this.queue.markPlayed(currentPlaying.id);
      }
      await this.queue.markPlaying(next.id);
      await this.spotify.play(next.spotifyUri);

      this.server.to(`event:${eventId}`).emit('track:playing', {
        trackId: next.spotifyTrackId,
        trackName: next.trackName,
        artist: next.artist,
        albumArt: next.albumArt,
      });

      await this.emitQueueUpdate(eventId);
    } catch (e) {
      this.logger.error(`[${eventId.slice(0,8)}] poll error: ${e}`);
    } finally {
      this.advancing.delete(eventId);
    }
  }
}
