import {
  bigint,
  index,
  pgTable,
  primaryKey,
  text,
  varchar
} from 'drizzle-orm/pg-core';
import { z } from 'zod';

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

// App-level guard for the length caps the DB no longer enforces (refs #369/#370)
export const insertMessageSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  msg_hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  ts: z.number().int().positive(),
  network: z.string().min(1).max(24),
  env: z.string().min(1).max(24)
});
