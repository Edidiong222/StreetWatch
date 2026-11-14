import { Comment } from '../entities/comment.entity';

export class CommentAuthorDto {
  id!: string;
  fullName!: string;
}

export class CommentResponseDto {
  id!: string;
  reportId!: string;
  author!: CommentAuthorDto;
  content!: string;
  isHidden!: boolean;
  moderationReason!: string | null;
  moderatedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(comment: Comment): CommentResponseDto {
    return {
      id: comment.id,
      reportId: comment.reportId,
      author: {
        id: comment.author.id,
        fullName: comment.author.fullName,
      },
      content: comment.content,
      isHidden: comment.isHidden,
      moderationReason: comment.moderationReason,
      moderatedAt: comment.moderatedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}

export class PaginatedCommentsResponseDto {
  data!: CommentResponseDto[];
  meta!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
