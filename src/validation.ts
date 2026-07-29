import { getAddress } from '@ethersproject/address';
import { capture } from '@snapshot-labs/snapshot-sentry';
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

// api.ts branches on the same condition to decide whether to resolve the space
// on the hub, and relies on this schema having required `space` in that arm
export const needsSpaceLookup = (
  types: Record<string, unknown>,
  settings: unknown
) => !types.Space && !settings;

// looseObject: unknown keys must pass through — the body is hashed (getHash)
// and relayed to the sequencer verbatim. zod rebuilds objects, so the hash and
// the stored payload are taken from req.body, never from parsed.data
export const messageRequestSchema = z
  .looseObject({
    address: z
      .string()
      .refine(isChecksummed, { message: 'Not a checksummed address' }),
    data: z.looseObject({
      // entries are left unvalidated: getHash rejects every malformed shape a
      // stricter schema would, and walking them here deep-copies a 4mb
      // caller-controlled map and overflows zod's stack at ~100k bad entries
      types: z.record(z.string(), z.unknown()),
      message: z.looseObject({
        timestamp: z.number().int().positive().max(MAX_TIMESTAMP),
        space: z.string().optional(),
        settings: z.unknown().optional()
      })
    })
  })
  .superRefine((b, ctx) => {
    if (
      needsSpaceLookup(b.data.types, b.data.message.settings) &&
      !b.data.message.space
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Missing space',
        path: ['data', 'message', 'space']
      });
  });

// safeParse is contractually total, but zod has already broken that contract
// here once (an unbounded issue array overflowed the stack), and express 4
// doesn't catch async throws — with no unhandledRejection handler installed,
// one throw takes the process down. null means "unparseable", not "invalid".
export function parseMessageRequest(body: unknown) {
  try {
    return messageRequestSchema.safeParse(body);
  } catch (err) {
    capture(err);
    return null;
  }
}
