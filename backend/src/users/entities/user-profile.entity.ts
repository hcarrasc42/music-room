import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';

export type Visibility = 'public' | 'friends' | 'private';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn()
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'varchar', nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', default: 'public' })
  bioVisibility: Visibility;

  @Column({ type: 'varchar', nullable: true })
  musicGenres: string | null;

  @Column({ type: 'varchar', nullable: true })
  favoriteArtists: string | null;

  @Column({ type: 'varchar', default: 'public' })
  musicVisibility: Visibility;
}
