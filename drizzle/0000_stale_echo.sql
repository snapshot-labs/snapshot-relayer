CREATE TABLE "messages" (
	"address" varchar(42) NOT NULL,
	"hash" varchar(66) NOT NULL,
	"msg_hash" varchar(66) NOT NULL,
	"ts" bigint NOT NULL,
	"payload" jsonb NOT NULL,
	"network" varchar(24) NOT NULL,
	"env" varchar(24) NOT NULL,
	CONSTRAINT "messages_address_hash_pk" PRIMARY KEY("address","hash")
);
--> statement-breakpoint
CREATE INDEX "messages_ts_idx" ON "messages" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "messages_msg_hash_idx" ON "messages" USING btree ("msg_hash");