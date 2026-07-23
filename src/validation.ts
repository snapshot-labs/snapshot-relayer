import { getAddress } from '@ethersproject/address';
import { z } from 'zod';

// ~year 2286; rejects ms-epoch mistakes and bigint-overflow values
const MAX_TIMESTAMP = 10_000_000_000;

const isChecksummed = (a: string) => {
  try {
    return getAddress(a) === a;
  } catch {
    return false;
  }
};

// passthrough: parsed.data must stay byte-equivalent to the raw body — it is
// hashed (getHash) and relayed verbatim to the sequencer
export const messageRequestSchema = z
  .object({
    address: z
      .string()
      .refine(isChecksummed, { message: 'Not a checksummed address' }),
    data: z
      .object({
        types: z.record(z.unknown()),
        message: z
          .object({
            timestamp: z.number().int().positive().max(MAX_TIMESTAMP),
            space: z.string().optional(),
            settings: z.unknown()
          })
          .passthrough()
      })
      .passthrough()
  })
  .passthrough()
  .superRefine((b, ctx) => {
    if (
      !b.data.types.Space &&
      !b.data.message.settings &&
      !b.data.message.space
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Missing space',
        path: ['data', 'message', 'space']
      });
  });
