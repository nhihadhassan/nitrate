ALTER TABLE "nitrate"."selection_rounds"
  ADD COLUMN "wheel_pool_overridden_by_user_id" uuid,
  ADD COLUMN "wheel_result_mode" text DEFAULT 'random' NOT NULL,
  ADD COLUMN "wheel_result_overridden_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "nitrate"."selection_rounds"
  ADD CONSTRAINT "selection_rounds_wheel_pool_overridden_by_user_id_users_id_fk"
    FOREIGN KEY ("wheel_pool_overridden_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE set null ON UPDATE no action,
  ADD CONSTRAINT "selection_rounds_wheel_result_overridden_by_user_id_users_id_fk"
    FOREIGN KEY ("wheel_result_overridden_by_user_id") REFERENCES "nitrate"."users"("id") ON DELETE set null ON UPDATE no action;
