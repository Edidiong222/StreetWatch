import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../entities/user.entity';

export class UserResponseDto {
  id!: string;
  email!: string;
  fullName!: string;
  role!: UserRole;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
