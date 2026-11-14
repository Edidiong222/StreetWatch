import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import {
  NotificationResponseDto,
  PaginatedNotificationsResponseDto,
} from './dto/notification-response.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @Query() query: QueryNotificationsDto,
    @CurrentUser() user: User,
  ): Promise<PaginatedNotificationsResponseDto> {
    return this.notificationsService.list(user, query);
  }

  @Get('unread-count')
  getUnreadCount(
    @CurrentUser() user: User,
  ): Promise<{ unreadCount: number }> {
    return this.notificationsService.getUnreadCount(user);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: User): Promise<{ updated: number }> {
    return this.notificationsService.markAllRead(user);
  }

  @Patch(':id/read')
  markRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markRead(id, user);
  }
}
