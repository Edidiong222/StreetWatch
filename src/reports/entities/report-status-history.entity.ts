import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReportStatus } from '../../common/enums/report-status.enum';
import { User } from '../../users/entities/user.entity';
import { Report } from '../../reports/entities/report.entity';

@Entity({ name: 'report_status_history' })
@Index('IDX_report_status_history_report_id', ['reportId'])
@Index('IDX_report_status_history_changed_by_id', ['changedById'])
@Index('IDX_report_status_history_created_at', ['createdAt'])
export class ReportStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId!: string;

  @ManyToOne(() => Report, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'report_id' })
  report!: Report;

  @Column({
    name: 'previous_status',
    type: 'enum',
    enum: ReportStatus,
    enumName: 'reports_status_enum',
  })
  previousStatus!: ReportStatus;

  @Column({
    name: 'new_status',
    type: 'enum',
    enum: ReportStatus,
    enumName: 'reports_status_enum',
  })
  newStatus!: ReportStatus;

  @Column({ name: 'changed_by_id', type: 'uuid' })
  changedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'changed_by_id' })
  changedBy!: User;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
