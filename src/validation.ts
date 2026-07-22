import { getAddress } from '@ethersproject/address';
import { z } from 'zod';

// ~year 2286; rejects ms-epoch mistakes and bigint-overflow values
const MAX_TIMESTAMP = 10_000_000_000;

const isChecksummed = (a: unknown) => {
  try {
    return getAddress(a as string) === a;
  } catch {
    return false;
  }
};

export const messageRequestSchema = z
  .any()
  // Chain order is load-bearing: zod v3 runs every refine and collects
  // issues in declaration order; api.ts returns issues[0] (first error wins)
  .refine(b => b?.data?.message, { message: 'Invalid format request' })
  .refine(b => b?.data?.types, { message: 'Invalid format request' })
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
      return Number.isInteger(ts) && ts > 0 && ts <= MAX_TIMESTAMP;
    },
    { message: 'Invalid timestamp' }
  );
