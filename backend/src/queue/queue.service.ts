import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventsService } from '../events/events.service.js';
import { SuggestTrackDto } from './dto/suggest-track.dto.js';
import { Suggestion } from './entities/suggestion.entity.js';
import { Vote } from './entities/vote.entity.js';

@Injectable()
export class QueueService {
  constructor(
    @InjectRepository(Suggestion) private suggestions: Repository<Suggestion>,
    @InjectRepository(Vote) private votes: Repository<Vote>,
    private eventsService: EventsService,
  ) {}

  async getSuggestions(eventId: string, userId = '') {
    const qb = this.suggestions
      .createQueryBuilder('s')
      .leftJoin('votes', 'v', 'v.suggestionId = s.id')
      .where('s.eventId = :eventId', { eventId })
      .andWhere("s.status = 'queued'")
      .select('s.id', 'id')
      .addSelect('s.spotifyTrackId', 'spotifyTrackId')
      .addSelect('s.spotifyUri', 'spotifyUri')
      .addSelect('s.trackName', 'trackName')
      .addSelect('s.artist', 'artist')
      .addSelect('s.albumArt', 'albumArt')
      .addSelect('s.status', 'status')
      .addSelect('s.suggestedById', 'suggestedById')
      .addSelect('COUNT(v.id)', 'votes');

    if (userId) {
      qb.addSelect(
        `EXISTS(SELECT 1 FROM votes uv WHERE uv."suggestionId" = s.id AND uv."userId" = :userId)`,
        'userVoted',
      ).setParameter('userId', userId);
    } else {
      qb.addSelect('false', 'userVoted');
    }

    return qb.groupBy('s.id').orderBy('"votes"', 'DESC').getRawMany();
  }

  async deleteSuggestion(id: string, userId: string) {
    const s = await this.suggestions.findOneBy({ id });
    if (!s) throw new NotFoundException('Suggestion not found');
    if (s.suggestedById !== userId) throw new ForbiddenException('Not your suggestion');
    if (s.status !== 'queued') throw new ForbiddenException('Cannot delete a playing or played suggestion');
    await this.votes.delete({ suggestionId: id });
    await this.suggestions.delete(id);
    return { message: 'Suggestion deleted' };
  }

  async suggest(eventId: string, userId: string, dto: SuggestTrackDto) {
    return this.suggestions.save({ eventId, suggestedById: userId, status: 'queued', ...dto });
  }

  async vote(suggestionId: string, userId: string, lat?: number, lng?: number) {
    const suggestion = await this.suggestions.findOneBy({ id: suggestionId });
    if (!suggestion) throw new NotFoundException('Suggestion not found');
    const canVote = await this.eventsService.canVote(suggestion.eventId, userId, lat, lng);
    if (!canVote) throw new ForbiddenException('You are not allowed to vote in this event');
    try {
      return await this.votes.save({ suggestionId, userId });
    } catch {
      throw new ForbiddenException('Already voted for this track');
    }
  }

  async unvote(suggestionId: string, userId: string) {
    await this.votes.delete({ suggestionId, userId });
    return { message: 'Vote removed' };
  }

  async getTopQueued(eventId: string): Promise<Suggestion | null> {
    const rows = await this.suggestions
      .createQueryBuilder('s')
      .leftJoin('votes', 'v', 'v.suggestionId = s.id')
      .where('s.eventId = :eventId', { eventId })
      .andWhere("s.status = 'queued'")
      .addSelect('COUNT(v.id)', 'voteCount')
      .groupBy('s.id')
      .orderBy('"voteCount"', 'DESC')
      .limit(1)
      .getMany();
    return rows[0] ?? null;
  }

  async markPlaying(suggestionId: string) {
    await this.suggestions.update(suggestionId, { status: 'playing' });
  }

  async markPlayed(suggestionId: string) {
    await this.suggestions.update(suggestionId, { status: 'played' });
  }

  async getCurrentPlaying(eventId: string): Promise<Suggestion | null> {
    return this.suggestions.findOne({ where: { eventId, status: 'playing' } });
  }
}
