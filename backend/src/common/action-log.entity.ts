import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('action_logs')
export class ActionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  // Método + ruta con parámetros sin sustituir, p. ej. "POST /suggestions/:id/vote"
  @Column()
  action: string;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ default: 'unknown' })
  platform: string;

  @Column({ name: 'device_model', default: 'unknown' })
  deviceModel: string;

  @Column({ name: 'app_version', default: 'unknown' })
  appVersion: string;

  @Column({ type: 'varchar', nullable: true })
  ip: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
