import {
  Column, CreateDateColumn, Entity,
  ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) owner: User;
  @Column() ownerId: string;
  @Column() name: string;
  @Column({ default: true }) isPublic: boolean;
  @Column({ default: 'open' }) license: 'open' | 'invited' | 'geo';
  @Column({ type: 'float', nullable: true }) lat: number | null;
  @Column({ type: 'float', nullable: true }) lng: number | null;
  @Column({ type: 'int', nullable: true }) radiusM: number | null;
  @Column({ type: 'varchar', nullable: true }) timeStart: string | null;
  @Column({ type: 'varchar', nullable: true }) timeEnd: string | null;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
}
