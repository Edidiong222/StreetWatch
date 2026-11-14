import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { NotificationType } from '../common/enums/notification-type.enum';
import { User } from '../users/entities/user.entity';
import {
  NotificationResponseDto,
  PaginatedNotificationsResponseDto,
} from './dto/notification-response.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { Notification } from './entities/notification.entity';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  reportId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  async create(
    input: CreateNotificationInput,
    manager?: EntityManager,
  ): Promise<Notification> {
    const repository = manager
      ? manager.getRepository(Notification)
      : this.notificationsRepository;

    const notification = repository.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      reportId: input.reportId ?? null,
      isRead: false,
    });

    return repository.save(notification);
  }

  async list(
    user: User,
    query: QueryNotificationsDto,
  ): Promise<PaginatedNotificationsResponseDto> {
    const where = query.unreadOnly
      ? { userId: user.id, isRead: false }
      : { userId: user.id };

    const [notifications, total] = await this.notificationsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      data: notifications.map(NotificationResponseDto.fromEntity),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getUnreadCount(user: User): Promise<{ unreadCount: number }> {
    const unreadCount = await this.notificationsRepository.count({
      where: { userId: user.id, isRead: false },
    });

    return { unreadCount };
  }

  async markRead(
    id: string,
    user: User,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationsRepository.findOne({
      where: { id, userId: user.id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await this.notificationsRepository.save(notification);
    }

    return NotificationResponseDto.fromEntity(notification);
  }

  async markAllRead(user: User): Promise<{ updated: number }> {
    const result = await this.notificationsRepository.update(
      { userId: user.id, isRead: false },
      { isRead: true, readAt: new Date() },
    );

    return { updated: result.affected ?? 0 };
  }
}
