import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  // Siempre en minúsculas (ver common/validation/username.ts)
  @Column({ type: 'varchar', unique: true })
  username: string;

  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleId: string | null;

  @Column({ default: false })
  isVerified: boolean;

  // Contraseñas fallidas seguidas; al llegar al máximo la cuenta se bloquea un rato
  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  // Los access tokens emitidos antes de esta fecha dejan de valer
  // (logout en todos los dispositivos, cambio de contraseña)
  @Column({ type: 'timestamptz', nullable: true })
  sessionsValidAfter: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
