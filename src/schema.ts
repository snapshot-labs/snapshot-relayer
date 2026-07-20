import {
  bigint,
  customType,
  index,
  pgTable,
  primaryKey,
  varchar
} from 'drizzle-orm/pg-core';

// Stored as jsonb, but the app only ever relays the payload verbatim
// (GET /api/messages/:hash and the sequencer both expect the pre-migration
// JSON-string shape), so it is read and written as a raw JSON string.
const jsonbString = customType<{ data: string; driverData: unknown }>({
  dataType() {
    return 'jsonb';
  },
  fromDriver(value): string {
    return JSON.stringify(value);
  }
});

export const messages = pgTable(
  'messages',
  {
    address: varchar({ length: 42 }).notNull(),
    hash: varchar({ length: 66 }).notNull(),
    // snake_case to preserve the JSON shape served by GET /api/messages/:hash
    msg_hash: varchar({ length: 66 }).notNull(),
    ts: bigint({ mode: 'number' }).notNull(),
    payload: jsonbString().notNull(),
    network: varchar({ length: 24 }).notNull(),
    env: varchar({ length: 24 }).notNull()
  },
  table => [
    primaryKey({ columns: [table.address, table.hash] }),
    index('messages_ts_idx').on(table.ts),
    index('messages_msg_hash_idx').on(table.msg_hash)
  ]
);
