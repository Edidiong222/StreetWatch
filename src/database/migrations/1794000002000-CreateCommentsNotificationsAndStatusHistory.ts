import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommentsNotificationsAndStatusHistory1794000002000
  implements MigrationInterface
{
  name = 'CreateCommentsNotificationsAndStatusHistory1794000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."notifications_type_enum" AS ENUM (
          'REPORT_APPROVED',
          'REPORT_REJECTED',
          'REPORT_STATUS_CHANGED',
          'REPORT_RESOLVED',
          'REPORT_COMMENT'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "report_status_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_id" uuid NOT NULL,
        "previous_status" "public"."reports_status_enum" NOT NULL,
        "new_status" "public"."reports_status_enum" NOT NULL,
        "changed_by_id" uuid NOT NULL,
        "note" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_status_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_report_status_history_report" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_report_status_history_changed_by" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_report_status_history_report_id" ON "report_status_history" ("report_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_report_status_history_changed_by_id" ON "report_status_history" ("changed_by_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_report_status_history_created_at" ON "report_status_history" ("created_at")',
    );

    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "content" text NOT NULL,
        "is_hidden" boolean NOT NULL DEFAULT false,
        "moderation_reason" character varying(255),
        "moderated_by_id" uuid,
        "moderated_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_comments_report" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comments_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_comments_moderated_by" FOREIGN KEY ("moderated_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_comments_report_id_created_at" ON "comments" ("report_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_comments_author_id" ON "comments" ("author_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_comments_is_hidden" ON "comments" ("is_hidden")',
    );

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" "public"."notifications_type_enum" NOT NULL,
        "title" character varying(150) NOT NULL,
        "message" character varying(500) NOT NULL,
        "report_id" uuid,
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notifications_report" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_notifications_user_id_created_at" ON "notifications" ("user_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_notifications_user_id_is_read" ON "notifications" ("user_id", "is_read")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_notifications_report_id" ON "notifications" ("report_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_notifications_report_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_notifications_user_id_is_read"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_notifications_user_id_created_at"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "notifications"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_comments_is_hidden"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_comments_author_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_comments_report_id_created_at"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "comments"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_report_status_history_created_at"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_report_status_history_changed_by_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."IDX_report_status_history_report_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "report_status_history"');
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."notifications_type_enum"',
    );
  }
}
