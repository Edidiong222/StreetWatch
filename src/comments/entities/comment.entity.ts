import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Report } from '../../reports/entities/report.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'comments' })
@Index('IDX_comments_report_id_created_at', ['reportId', 'createdAt'])
@Index('IDX_comments_author_id', ['authorId'])
@Index('IDX_comments_is_hidden', ['isHidden'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId!: string;

  @ManyToOne(() => Report, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'report_id' })
  report!: Report;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden!: boolean;

  @Column({
    name: 'moderation_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  moderationReason!: string | null;

  @Column({ name: 'moderated_by_id', type: 'uuid', nullable: true })
  moderatedById!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'moderated_by_id' })
  moderatedBy!: User | null;

  @Column({
    name: 'moderated_at',
    type: 'timestamptz',
    nullable: true,
  })
  moderatedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
