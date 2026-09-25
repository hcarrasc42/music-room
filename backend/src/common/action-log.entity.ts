import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('action_logs')
export class ActionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  userId: string;

  @Column()
  action: string;

  @Column({ default: 'unknown' })
  platform: string;

  @Column({ name: 'device_model', default: 'unknown' })
  deviceModel: string;

  @Column({ name: 'app_version', default: 'unknown' })
  appVersion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
