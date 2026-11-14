import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';
import { CommentsService } from './comments.service';
import {
  CommentResponseDto,
  PaginatedCommentsResponseDto,
} from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ModerateCommentDto } from './dto/moderate-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('reports/:reportId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Query() query: QueryCommentsDto,
    @CurrentUser() user?: User | null,
  ): Promise<PaginatedCommentsResponseDto> {
    return this.commentsService.list(reportId, user, query);
  }

  @Post('reports/:reportId/comments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CITIZEN)
  create(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User,
  ): Promise<CommentResponseDto> {
    return this.commentsService.create(reportId, dto, user);
  }

  @Patch('comments/:id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  moderate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ModerateCommentDto,
    @CurrentUser() user: User,
  ): Promise<CommentResponseDto> {
    return this.commentsService.moderate(id, dto, user);
  }

  @Patch('comments/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: User,
  ): Promise<CommentResponseDto> {
    return this.commentsService.update(id, dto, user);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ): Promise<{ deleted: boolean }> {
    return this.commentsService.remove(id, user);
  }
}
