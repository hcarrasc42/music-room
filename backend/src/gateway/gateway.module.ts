import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Event } from '../events/entities/event.entity.js';
import { QueueModule } from '../queue/queue.module.js';
import { SpotifyModule } from '../spotify/spotify.module.js';
import { EventsGateway } from './events.gateway.js';
import { PlayerController } from './player.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), QueueModule, SpotifyModule, AuthModule],
  controllers: [PlayerController],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
