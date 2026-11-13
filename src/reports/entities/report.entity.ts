import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { ReportStatus } from '../../common/enums/report-status.enum';
import { User } from '../../users/entities/user.entity';
import { ReportImage } from './report-image.entity';

const numericTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};

@Entity({ name: 'reports' })
@Index('IDX_reports_status', ['status'])
@Index('IDX_reports_category_id', ['categoryId'])
@Index('IDX_reports_creator_id', ['creatorId'])
@Index('IDX_reports_created_at', ['createdAt'])
@Check('CHK_reports_verification_count_non_negative', '"verification_count" >= 0')
@Check(
  'CHK_reports_latitude_range',
  '"latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)',
)
@Check(
  'CHK_reports_longitude_range',
  '"longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)',
)
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @Column({ type: 'varchar', length: 255 })
  location!: string;

  @Column({
    type: 'numeric',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: numericTransformer,
  })
  latitude!: number | null;

  @Column({
    type: 'numeric',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: numericTransformer,
  })
  longitude!: number | null;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'creator_id' })
  creator!: User;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    enumName: 'reports_status_enum',
    default: ReportStatus.PENDING_REVIEW,
  })
  status!: ReportStatus;

  @Column({ name: 'verification_count', type: 'integer', default: 0 })
  verificationCount!: number;

  @OneToMany(() => ReportImage, (image) => image.report)
  images!: ReportImage[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
