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

/** Whether `space` must be resolved on the hub. The schema below requires
 *  `space` in exactly this arm, and api.ts branches on the same condition. */
export const needsSpaceLookup = (
  types: Record<string, unknown>,
  settings: unknown
) => !types.Space && !settings;

/** Validation gate for POST /. looseObject so unknown keys survive, but zod
 *  still rebuilds objects — hash and store req.body, never parsed.data. */
export const messageRequestSchema = z
  .looseObject({
    address: z
      .string()
      .refine(isChecksummed, { message: 'Not a checksummed address' }),
    data: z.looseObject({
      // entries are getHash's job: it rejects the same malformed shapes without
      // deep-walking a 4mb map (~100k bad entries overflowed zod's stack)
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

/**
 * safeParse, guarded: zod has broken its no-throw contract here before, and a
 * throw in an express 4 async handler is an unhandled rejection that kills the
 * process.
 * @returns the parse result; a throw becomes a failure with no issues.
 */
export function parseMessageRequest(body: unknown) {
  try {
    return messageRequestSchema.safeParse(body);
  } catch (err) {
    capture(err);
    return { success: false, error: new z.ZodError([]) } as const;
  }
}
