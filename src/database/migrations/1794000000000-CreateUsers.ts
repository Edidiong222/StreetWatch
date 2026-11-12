import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1794000000000 implements MigrationInterface {
  name = 'CreateUsers1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."users_role_enum" AS ENUM ('CITIZEN', 'ADMIN', 'SUPER_ADMIN');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$;
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "full_name" character varying(120) NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'CITIZEN',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_users_role" ON "users" ("role")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_users_role"');
    await queryRunner.query('DROP TABLE IF EXISTS "public"."users"');
    await queryRunner.query('DROP TYPE IF EXISTS "public"."users_role_enum"');
  }
}
