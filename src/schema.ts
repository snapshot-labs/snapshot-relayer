import {
  bigint,
  index,
  pgTable,
  primaryKey,
  text,
  varchar
} from 'drizzle-orm/pg-core';

export const messages = pgTable(
  'messages',
  {
    address: varchar({ length: 42 }).notNull(),
    hash: varchar({ length: 66 }).notNull(),
    // snake_case to preserve the JSON shape served by GET /api/messages/:hash
    msg_hash: varchar({ length: 66 }).notNull(),
    ts: bigint({ mode: 'number' }).notNull(),
    // Opaque JSON string relayed verbatim to the sequencer and
    // GET /api/messages/:hash; text keeps it byte-for-byte.
    payload: text().notNull(),
    network: varchar({ length: 24 }).notNull(),
    env: varchar({ length: 24 }).notNull()
  },
  table => [
    primaryKey({ columns: [table.address, table.hash] }),
    index('messages_ts_idx').on(table.ts),
    index('messages_msg_hash_idx').on(table.msg_hash)
  ]
);
