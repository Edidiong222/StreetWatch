import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotificationType } from '../common/enums/notification-type.enum';
import { PUBLIC_REPORT_STATUSES } from '../common/enums/report-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { Report } from '../reports/entities/report.entity';
import { ReportsService } from '../reports/reports.service';
import { User } from '../users/entities/user.entity';
import { CommentResponseDto, PaginatedCommentsResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ModerateCommentDto } from './dto/moderate-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    private readonly reportsService: ReportsService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    reportId: string,
    dto: CreateCommentDto,
    author: User,
  ): Promise<CommentResponseDto> {
    const comment = await this.dataSource.transaction(async (manager) => {
      const report = await manager.getRepository(Report).findOne({
        where: { id: reportId },
      });

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      if (!PUBLIC_REPORT_STATUSES.includes(report.status)) {
        throw new BadRequestException(
          'Comments can only be added to approved reports',
        );
      }

      const repository = manager.getRepository(Comment);
      const saved = await repository.save(
        repository.create({
          reportId,
          authorId: author.id,
          content: dto.content,
          isHidden: false,
        }),
      );

      if (report.creatorId !== author.id) {
        await this.notificationsService.create(
          {
            userId: report.creatorId,
            type: NotificationType.REPORT_COMMENT,
            title: 'New comment on your report',
            message: `${author.fullName} commented on your report "${report.title}".`,
            reportId: report.id,
          },
          manager,
        );
      }

      saved.author = author;
      return saved;
    });

    return CommentResponseDto.fromEntity(comment);
  }

  async list(
    reportId: string,
    viewer: User | null | undefined,
    query: QueryCommentsDto,
  ): Promise<PaginatedCommentsResponseDto> {
    const report = await this.reportsService.findViewableReport(reportId, viewer);
    const isAdmin =
      viewer?.role === UserRole.ADMIN || viewer?.role === UserRole.SUPER_ADMIN;
    const includeHidden = query.includeHidden && isAdmin;

    const builder = this.commentsRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.report_id = :reportId', { reportId: report.id });

    if (!includeHidden) {
      builder.andWhere('comment.is_hidden = false');
    }

    builder
      .orderBy('comment.createdAt', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [comments, total] = await builder.getManyAndCount();

    return {
      data: comments.map(CommentResponseDto.fromEntity),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async update(
    id: string,
    dto: UpdateCommentDto,
    user: User,
  ): Promise<CommentResponseDto> {
    const comment = await this.findCommentOrFail(id);

    if (comment.authorId !== user.id) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    if (comment.isHidden) {
      throw new BadRequestException('Hidden comments cannot be edited');
    }

    comment.content = dto.content;
    const saved = await this.commentsRepository.save(comment);

    return CommentResponseDto.fromEntity(saved);
  }

  async remove(id: string, user: User): Promise<{ deleted: boolean }> {
    const comment = await this.findCommentOrFail(id);

    if (comment.authorId !== user.id) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.commentsRepository.remove(comment);

    return { deleted: true };
  }

  async moderate(
    id: string,
    dto: ModerateCommentDto,
    administrator: User,
  ): Promise<CommentResponseDto> {
    const comment = await this.findCommentOrFail(id);

    comment.isHidden = dto.hidden;
    comment.moderationReason = dto.hidden ? dto.reason?.trim() || null : null;
    comment.moderatedById = administrator.id;
    comment.moderatedAt = new Date();

    const saved = await this.commentsRepository.save(comment);

    return CommentResponseDto.fromEntity(saved);
  }

  private async findCommentOrFail(id: string): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: { author: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return comment;
  }
}
