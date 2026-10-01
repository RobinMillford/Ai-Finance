CREATE TABLE "candles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"interval" varchar(16) DEFAULT '1day' NOT NULL,
	"open" numeric(18, 6) NOT NULL,
	"high" numeric(18, 6) NOT NULL,
	"low" numeric(18, 6) NOT NULL,
	"close" numeric(18, 6) NOT NULL,
	"volume" numeric(24, 2),
	"adjustment_mode" varchar(16) DEFAULT 'unknown' NOT NULL,
	"source_provider" varchar(16) NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candles_ohlc_positive_check" CHECK ("candles"."open" >= 0 AND "candles"."high" >= 0 AND "candles"."low" >= 0 AND "candles"."close" >= 0),
	CONSTRAINT "candles_volume_nonnegative_check" CHECK ("candles"."volume" IS NULL OR "candles"."volume" >= 0),
	CONSTRAINT "candles_source_provider_check" CHECK ("candles"."source_provider" IN ('twelvedata', 'eulerpool')),
	CONSTRAINT "candles_adjustment_mode_check" CHECK ("candles"."adjustment_mode" IN ('adjusted', 'unadjusted', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"chat_type" varchar(16) DEFAULT 'main' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_chat_type_check" CHECK ("conversations"."chat_type" IN ('main', 'stock', 'forex'))
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"provider" varchar(100),
	"agent" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_role_check" CHECK ("messages"."role" IN ('user', 'assistant', 'system')),
	CONSTRAINT "messages_content_len_check" CHECK (char_length("messages"."content") > 0)
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolios_name_len_check" CHECK (char_length("portfolios"."name") > 0)
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"asset_type" varchar(16) NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"average_cost" numeric(18, 6) NOT NULL,
	"purchase_date" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_quantity_positive_check" CHECK ("positions"."quantity" > 0),
	CONSTRAINT "positions_cost_nonnegative_check" CHECK ("positions"."average_cost" >= 0),
	CONSTRAINT "positions_asset_type_check" CHECK ("positions"."asset_type" IN ('stock', 'crypto', 'forex'))
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"asset_type" varchar(16) NOT NULL,
	"side" varchar(4) NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"price" numeric(18, 6) NOT NULL,
	"fees" numeric(18, 6) DEFAULT '0' NOT NULL,
	"transaction_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_quantity_positive_check" CHECK ("transactions"."quantity" > 0),
	CONSTRAINT "transactions_price_nonnegative_check" CHECK ("transactions"."price" >= 0),
	CONSTRAINT "transactions_fees_nonnegative_check" CHECK ("transactions"."fees" >= 0),
	CONSTRAINT "transactions_side_check" CHECK ("transactions"."side" IN ('buy', 'sell')),
	CONSTRAINT "transactions_asset_type_check" CHECK ("transactions"."asset_type" IN ('stock', 'crypto', 'forex'))
);
--> statement-breakpoint
CREATE TABLE "user_tracked_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"asset_type" varchar(16) NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tracked_assets_asset_type_check" CHECK ("user_tracked_assets"."asset_type" IN ('stock', 'crypto', 'forex'))
);
--> statement-breakpoint
CREATE TABLE "user_watchlist_symbols" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text,
	"image" text,
	"email_verification_token" text,
	"email_verification_token_expiry" timestamp with time zone,
	"is_public" boolean DEFAULT false NOT NULL,
	"notification_preferences" jsonb DEFAULT '{"email":true,"marketAlerts":true,"priceChanges":true,"portfolioUpdates":true,"aiRecommendations":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchlist_id" uuid NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"asset_type" varchar(16) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"alert_price" numeric(18, 6),
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_items_asset_type_check" CHECK ("watchlist_items"."asset_type" IN ('stock', 'crypto', 'forex'))
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tracked_assets" ADD CONSTRAINT "user_tracked_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_watchlist_symbols" ADD CONSTRAINT "user_watchlist_symbols_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candles_identity_unique" ON "candles" USING btree ("symbol","interval","timestamp","adjustment_mode");--> statement-breakpoint
CREATE INDEX "candles_symbol_time_idx" ON "candles" USING btree ("symbol","interval","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversations_user_created_idx" ON "conversations" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expiry_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "portfolios_user_created_idx" ON "portfolios" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "positions_identity_unique" ON "positions" USING btree ("portfolio_id","symbol","asset_type");--> statement-breakpoint
CREATE INDEX "positions_portfolio_idx" ON "positions" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "transactions_portfolio_idx" ON "transactions" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "transactions_symbol_idx" ON "transactions" USING btree ("portfolio_id","symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tracked_assets_identity_unique" ON "user_tracked_assets" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "user_watchlist_symbols_identity_unique" ON "user_watchlist_symbols" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_items_identity_unique" ON "watchlist_items" USING btree ("watchlist_id","symbol");--> statement-breakpoint
CREATE INDEX "watchlist_items_watchlist_idx" ON "watchlist_items" USING btree ("watchlist_id");--> statement-breakpoint
CREATE INDEX "watchlists_user_created_idx" ON "watchlists" USING btree ("user_id","created_at" DESC NULLS LAST);