import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.getOrThrow<string>('DB_HOST'),
        port: configService.getOrThrow<number>('DB_PORT'),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD') ?? '',
        database: configService.getOrThrow<string>('DB_NAME'),
        autoLoadEntities: true,
        migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
        synchronize: false,
        migrationsRun: false,
        logging:
          configService.get<string>('NODE_ENV') === 'test'
            ? false
            : (['error', 'warn'] as const),
        ssl: configService.get<boolean>('DB_SSL')
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),
  ],
})
export class DatabaseModule {}
