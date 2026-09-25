import { Body, Controller, Delete, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { SuggestTrackDto } from './dto/suggest-track.dto.js';
import { QueueService } from './queue.service.js';

@Controller()
@UseGuards(JwtGuard)
export class QueueController {
  constructor(private queue: QueueService) {}

  @Get('events/:eventId/suggestions')
  getSuggestions(@CurrentUser() u: { id: string }, @Param('eventId') eventId: string) {
    return this.queue.getSuggestions(eventId, u.id);
  }

  @Delete('suggestions/:id')
  deleteSuggestion(@CurrentUser() u: { id: string }, @Param('id') id: string) {
    return this.queue.deleteSuggestion(id, u.id);
  }

  @Post('events/:eventId/suggestions')
  suggest(
    @CurrentUser() u: { id: string },
    @Param('eventId') eventId: string,
    @Body() dto: SuggestTrackDto,
  ) {
    return this.queue.suggest(eventId, u.id, dto);
  }

  @Post('suggestions/:id/vote')
  vote(
    @CurrentUser() u: { id: string; email: string },
    @Param('id') id: string,
    @Headers('x-lat') lat: string | undefined,
    @Headers('x-lng') lng: string | undefined,
  ) {
    return this.queue.vote(id, u.id, lat ? parseFloat(lat) : undefined, lng ? parseFloat(lng) : undefined);
  }

  @Delete('suggestions/:id/vote')
  unvote(@CurrentUser() u: { id: string }, @Param('id') id: string) {
    return this.queue.unvote(id, u.id);
  }
}
