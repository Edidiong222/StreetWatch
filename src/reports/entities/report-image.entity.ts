import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Report } from './report.entity';

@Entity({ name: 'report_images' })
@Index('IDX_report_images_report_id', ['reportId'])
export class ReportImage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId!: string;

  @ManyToOne(() => Report, (report) => report.images, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'report_id' })
  report!: Report;

  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  @Column({ name: 'public_id', type: 'varchar', length: 255 })
  publicId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
