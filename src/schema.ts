import { getAddress } from '@ethersproject/address';
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

const isChecksummed = (a: unknown) => {
  try {
    return getAddress(a as string) === a;
  } catch {
    return false;
  }
};

export const messageRequestSchema = z
  .any()
  .refine(b => b?.data?.message, { message: 'Invalid format request' })
  .refine(
    b =>
      !b?.data?.message ||
      b.data.types?.Space ||
      b.data.message.settings ||
      b.data.message.space,
    { message: 'Missing space' }
  )
  .refine(b => isChecksummed(b?.address), { message: 'Invalid address' })
  .refine(
    b => {
      if (!b?.data?.message) return true;
      const ts = b.data.message.timestamp;
      // Upper bound rejects ms-epoch mistakes and bigint-overflow values
      return Number.isInteger(ts) && ts > 0 && ts <= 10_000_000_000;
    },
    { message: 'Invalid timestamp' }
  );
