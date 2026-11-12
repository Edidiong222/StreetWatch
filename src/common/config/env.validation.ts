import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  @IsOptional()
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT = 3001;

  @IsString()
  @IsNotEmpty()
  DB_HOST = 'localhost';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  DB_PORT = 5432;

  @IsString()
  DB_USERNAME = 'postgres';

  @IsString()
  @IsOptional()
  DB_PASSWORD = '';

  @IsString()
  @IsNotEmpty()
  DB_NAME = 'civicpulse';

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  DB_SSL = false;

  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  @Matches(/^\d+(ms|s|m|h|d)$/)
  @IsOptional()
  JWT_EXPIRES_IN = '1h';

  @IsString()
  @IsOptional()
  CORS_ORIGIN = 'http://localhost:3000';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .filter(Boolean)
      .join('; ');

    throw new Error(`Environment validation failed: ${details}`);
  }

  return validatedConfig;
}
