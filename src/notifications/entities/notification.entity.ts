import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { Report } from '../../reports/entities/report.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'notifications' })
@Index('IDX_notifications_user_id_created_at', ['userId', 'createdAt'])
@Index('IDX_notifications_user_id_is_read', ['userId', 'isRead'])
@Index('IDX_notifications_report_id', ['reportId'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notifications_type_enum',
  })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'varchar', length: 500 })
  message!: string;

  @Column({ name: 'report_id', type: 'uuid', nullable: true })
  reportId!: string | null;

  @ManyToOne(() => Report, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'report_id' })
  report!: Report | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
