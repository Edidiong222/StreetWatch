import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Report } from '../../reports/entities/report.entity';

@Entity({ name: 'report_verifications' })
@Unique('UQ_report_verifications_report_user', ['reportId', 'userId'])
@Index('IDX_report_verifications_report_id', ['reportId'])
@Index('IDX_report_verifications_user_id', ['userId'])
export class ReportVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId!: string;

  @ManyToOne(() => Report, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'report_id' })
  report!: Report;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
