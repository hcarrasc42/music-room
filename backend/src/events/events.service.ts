import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { EventInvite } from './entities/event-invite.entity.js';
import { Event } from './entities/event.entity.js';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event) private events: Repository<Event>,
    @InjectRepository(EventInvite) private invites: Repository<EventInvite>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  create(ownerId: string, dto: CreateEventDto) {
    return this.events.save({
      ownerId,
      ...dto,
      isPublic: dto.isPublic ?? true,
      license: dto.license ?? 'open',
    });
  }

  findPublic() {
    return this.events.find({ where: { isPublic: true, isActive: true } });
  }

  async findOne(eventId: string, userId: string) {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException('Event not found');
    if (!event.isPublic) {
      const invited = await this.invites.findOneBy({ eventId, userId });
      if (!invited && event.ownerId !== userId) throw new ForbiddenException('Private event');
    }
    return event;
  }

  async update(ownerId: string, eventId: string, dto: Partial<CreateEventDto>) {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException();
    if (event.ownerId !== ownerId) throw new ForbiddenException();
    await this.events.update(eventId, dto);
    return this.events.findOneBy({ id: eventId });
  }

  async close(ownerId: string, eventId: string) {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException();
    if (event.ownerId !== ownerId) throw new ForbiddenException();
    await this.events.update(eventId, { isActive: false });
    return { message: 'Event closed' };
  }

  async invite(ownerId: string, eventId: string, email: string) {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException();
    if (event.ownerId !== ownerId) throw new ForbiddenException();
    const user = await this.users.findOneBy({ email });
    if (!user) throw new NotFoundException('User not found');
    await this.invites.save({ eventId, userId: user.id });
    return { message: 'User invited' };
  }

  async canVote(eventId: string, userId: string, lat?: number, lng?: number): Promise<boolean> {
    const event = await this.events.findOneBy({ id: eventId, isActive: true });
    if (!event) return false;

    if (event.license === 'open') return true;

    if (event.license === 'invited') {
      if (event.ownerId === userId) return true;
      const invite = await this.invites.findOneBy({ eventId, userId });
      return !!invite;
    }

    if (event.license === 'geo') {
      if (!lat || !lng || !event.lat || !event.lng || !event.radiusM) return false;
      const dist = haversine(lat, lng, event.lat, event.lng);
      if (dist > event.radiusM) return false;
      if (event.timeStart && event.timeEnd) {
        const now = new Date().toTimeString().slice(0, 5);
        if (now < event.timeStart || now > event.timeEnd) return false;
      }
      return true;
    }

    return false;
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
