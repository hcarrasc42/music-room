import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { Event } from './event.entity.js';

@Entity('event_invites')
@Unique(['eventId', 'userId'])
export class EventInvite {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Event, { onDelete: 'CASCADE' }) event: Event;
  @Column() eventId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) user: User;
  @Column() userId: string;
}
