import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  findActive(): Promise<Category[]> {
    return this.categoriesRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  findAll(): Promise<Category[]> {
    return this.categoriesRepository.find({ order: { name: 'ASC' } });
  }

  async findByIdOrFail(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findActiveByIdOrFail(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id, isActive: true },
    });

    if (!category) {
      throw new BadRequestException('Category is invalid or inactive');
    }

    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const category = this.categoriesRepository.create({
      name: dto.name,
      slug: this.slugify(dto.name),
      description: dto.description,
      isActive: true,
    });

    try {
      return await this.categoriesRepository.save(category);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A category with this name already exists');
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findByIdOrFail(id);

    if (dto.name !== undefined) {
      category.name = dto.name;
      category.slug = this.slugify(dto.name);
    }

    if (dto.description !== undefined) {
      category.description = dto.description;
    }

    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }

    try {
      return await this.categoriesRepository.save(category);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A category with this name already exists');
      }

      throw error;
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } }).driverError
        ?.code === '23505'
    );
  }
}
