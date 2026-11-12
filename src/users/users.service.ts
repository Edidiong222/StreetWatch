import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { normalizeEmail } from '../common/utils/normalize-email';
import { User } from './entities/user.entity';

interface CreateCitizenInput {
  email: string;
  passwordHash: string;
  fullName: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: normalizeEmail(email) } });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  async createCitizen(input: CreateCitizenInput): Promise<User> {
    const user = this.usersRepository.create({
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      fullName: input.fullName.trim(),
      role: UserRole.CITIZEN,
    });

    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An account with this email already exists');
      }

      throw error;
    }
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: 'DESC' } });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
        '23505'
    );
  }
}
