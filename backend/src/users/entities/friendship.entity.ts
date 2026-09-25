import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';

@Entity('friendships')
@Unique(['userId', 'friendId'])
export class Friendship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  userEntity: User;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  friendEntity: User;

  @Column()
  friendId: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'accepted';

  @CreateDateColumn()
  createdAt: Date;
}
