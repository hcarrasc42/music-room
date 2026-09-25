import {
  Column, CreateDateColumn, Entity,
  ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { Event } from '../../events/entities/event.entity.js';

@Entity('suggestions')
export class Suggestion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Event, { onDelete: 'CASCADE' }) event: Event;
  @Column() eventId: string;
  @Column() spotifyTrackId: string;
  @Column() spotifyUri: string;
  @Column() trackName: string;
  @Column() artist: string;
  @Column({ type: 'varchar', nullable: true }) albumArt: string | null;
  @Column({ default: 'queued' }) status: 'queued' | 'playing' | 'played';
  @ManyToOne(() => User) suggestedBy: User;
  @Column() suggestedById: string;
  @CreateDateColumn() createdAt: Date;
}
