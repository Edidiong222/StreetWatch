import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReportsAndVerification1794000001000
  implements MigrationInterface
{
  name = 'CreateReportsAndVerification1794000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."reports_status_enum" AS ENUM (
          'PENDING_REVIEW',
          'APPROVED',
          'IN_PROGRESS',
          'RESOLVED',
          'REJECTED'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(80) NOT NULL,
        "slug" character varying(80) NOT NULL,
        "description" character varying(255),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_name" UNIQUE ("name"),
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_categories_is_active" ON "categories" ("is_active")',
    );

    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(150) NOT NULL,
        "description" text NOT NULL,
        "category_id" uuid NOT NULL,
        "location" character varying(255) NOT NULL,
        "latitude" numeric(9,6),
        "longitude" numeric(9,6),
        "creator_id" uuid NOT NULL,
        "status" "public"."reports_status_enum" NOT NULL DEFAULT 'PENDING_REVIEW',
        "verification_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_reports_verification_count_non_negative" CHECK ("verification_count" >= 0),
        CONSTRAINT "CHK_reports_latitude_range" CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
        CONSTRAINT "CHK_reports_longitude_range" CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)),
        CONSTRAINT "FK_reports_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_reports_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_reports_status" ON "reports" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_reports_category_id" ON "reports" ("category_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_reports_creator_id" ON "reports" ("creator_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_reports_created_at" ON "reports" ("created_at")',
    );

    await queryRunner.query(`
      CREATE TABLE "report_images" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_id" uuid NOT NULL,
        "url" character varying(2048) NOT NULL,
        "public_id" character varying(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_images" PRIMARY KEY ("id"),
        CONSTRAINT "FK_report_images_report" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_report_images_report_id" ON "report_images" ("report_id")',
    );

    await queryRunner.query(`
      CREATE TABLE "report_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_verifications" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_report_verifications_report_user" UNIQUE ("report_id", "user_id"),
        CONSTRAINT "FK_report_verifications_report" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_report_verifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_report_verifications_report_id" ON "report_verifications" ("report_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_report_verifications_user_id" ON "report_verifications" ("user_id")',
    );

    await queryRunner.query(`
      INSERT INTO "categories" ("name", "slug", "description")
      VALUES
        ('Roads & Transport', 'roads-transport', 'Road damage, potholes and transport infrastructure'),
        ('Water Supply', 'water-supply', 'Water shortages, leaks and supply interruptions'),
        ('Electricity', 'electricity', 'Power outages and electrical infrastructure issues'),
        ('Waste Management', 'waste-management', 'Waste collection and illegal dumping'),
        ('Public Infrastructure', 'public-infrastructure', 'Broken public facilities and street furniture'),
        ('Drainage & Flooding', 'drainage-flooding', 'Drainage problems and flooding'),
        ('Other', 'other', 'Other community issues')
      ON CONFLICT ("slug") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_report_verifications_user_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_report_verifications_report_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "report_verifications"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_report_images_report_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "report_images"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_reports_created_at"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_reports_creator_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_reports_category_id"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_reports_status"');
    await queryRunner.query('DROP TABLE IF EXISTS "reports"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_categories_is_active"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "categories"');
    await queryRunner.query('DROP TYPE IF EXISTS "public"."reports_status_enum"');
  }
}
