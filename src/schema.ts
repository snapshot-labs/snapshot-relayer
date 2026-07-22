import { bigint, index, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

export const messages = pgTable(
  'messages',
  {
    address: text().notNull(),
    hash: text().notNull(),
    // snake_case: key is served as-is by GET /api/messages/:hash
    msg_hash: text().notNull(),
    ts: bigint({ mode: 'number' }).notNull(),
    // text, not json: relayed verbatim, byte-for-byte
    payload: text().notNull(),
    network: text().notNull(),
    env: text().notNull()
  },
  table => [
    primaryKey({ columns: [table.address, table.hash] }),
    index('messages_ts_idx').on(table.ts),
    index('messages_msg_hash_idx').on(table.msg_hash)
  ]
);
