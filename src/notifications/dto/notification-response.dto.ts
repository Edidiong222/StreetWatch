import { NotificationType } from '../../common/enums/notification-type.enum';
import { Notification } from '../entities/notification.entity';

export class NotificationResponseDto {
  id!: string;
  type!: NotificationType;
  title!: string;
  message!: string;
  reportId!: string | null;
  isRead!: boolean;
  readAt!: Date | null;
  createdAt!: Date;

  static fromEntity(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      reportId: notification.reportId,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}

export class PaginatedNotificationsResponseDto {
  data!: NotificationResponseDto[];
  meta!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
