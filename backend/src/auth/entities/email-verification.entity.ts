import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity.js';

@Entity('email_verifications')
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  // HMAC del código de 6 dígitos (el código nunca se guarda en claro)
  @Column()
  tokenHash: string;

  @Column()
  expiresAt: Date;

  @Column()
  type: 'verify' | 'reset';

  // Intentos fallidos; al llegar al máximo el código deja de valer
  @Column({ default: 0 })
  attempts: number;

  @CreateDateColumn()
  createdAt: Date;
}
