import {
  Column, CreateDateColumn, Entity,
  ManyToOne, PrimaryGeneratedColumn, Unique,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { Suggestion } from './suggestion.entity.js';

@Entity('votes')
@Unique(['suggestionId', 'userId'])
export class Vote {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Suggestion, { onDelete: 'CASCADE' }) suggestion: Suggestion;
  @Column() suggestionId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) user: User;
  @Column() userId: string;
  @CreateDateColumn() createdAt: Date;
}
