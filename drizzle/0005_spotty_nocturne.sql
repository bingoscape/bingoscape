CREATE TABLE IF NOT EXISTS "bingoscape-next_submission_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_submission_comments" ADD CONSTRAINT "bingoscape-next_submission_comments_submission_id_bingoscape-next_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."bingoscape-next_submissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bingoscape-next_submission_comments" ADD CONSTRAINT "bingoscape-next_submission_comments_author_id_bingoscape-next_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."bingoscape-next_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
