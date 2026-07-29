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

// looseObject: unknown keys must pass through — the body is hashed (getHash)
// and relayed to the sequencer. zod rebuilds objects, so both the hash and
// the stored payload read req.body directly; parsed.data is a gate only
export const messageRequestSchema = z
  .looseObject({
    address: z
      .string()
      .refine(isChecksummed, { message: 'Not a checksummed address' }),
    data: z.looseObject({
      types: z.record(
        z.string(),
        z.array(z.looseObject({ name: z.string(), type: z.string() }))
      ),
      message: z.looseObject({
        timestamp: z.number().int().positive().max(MAX_TIMESTAMP),
        space: z.string().optional(),
        settings: z.unknown().optional()
      })
    })
  })
  .superRefine((b, ctx) => {
    if (
      !b.data.types.Space &&
      !b.data.message.settings &&
      !b.data.message.space
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Missing space',
        path: ['data', 'message', 'space']
      });
  });
