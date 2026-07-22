import { messageRequestSchema } from '../../src/schema';

const validBody = {
  address: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3',
  data: {
    types: { Vote: [] },
    message: { space: 'test.eth', timestamp: 1721600000 }
  }
};

const withMessage = (override: Record<string, any>) => ({
  ...validBody,
  data: {
    ...validBody.data,
    message: { ...validBody.data.message, ...override }
  }
});

describe('messageRequestSchema', () => {
  it('accepts a valid body', () => {
    expect(messageRequestSchema.safeParse(validBody).success).toBe(true);
  });

  it('accepts a body with types.Space and no message.space', () => {
    const body = {
      ...validBody,
      data: { types: { Space: [] }, message: { timestamp: 1721600000 } }
    };
    expect(messageRequestSchema.safeParse(body).success).toBe(true);
  });

  const invalidBodies: [string, any, string][] = [
    ['missing body', undefined, 'Invalid format request'],
    [
      'missing data.message',
      { address: validBody.address, data: { types: {} } },
      'Invalid format request'
    ],
    ['missing space', withMessage({ space: undefined }), 'Missing space'],
    [
      'malformed address',
      { ...validBody, address: '0xdeadbeef' },
      'Invalid address'
    ],
    [
      'non-checksummed (lowercase) address',
      { ...validBody, address: '0x91fd2c8d24767db4ece7069aa27832ffaf8590f3' },
      'Invalid address'
    ],
    [
      'address with invalid checksum',
      { ...validBody, address: '0x91fD2c8d24767db4Ece7069AA27832ffaf8590f3' },
      'Invalid address'
    ],
    ['missing address', { data: validBody.data }, 'Invalid address'],
    ['negative timestamp', withMessage({ timestamp: -1 }), 'Invalid timestamp'],
    ['zero timestamp', withMessage({ timestamp: 0 }), 'Invalid timestamp'],
    [
      'non-integer timestamp',
      withMessage({ timestamp: 1721600000.5 }),
      'Invalid timestamp'
    ],
    [
      'timestamp in milliseconds',
      withMessage({ timestamp: 1721600000000 }),
      'Invalid timestamp'
    ],
    [
      'string timestamp',
      withMessage({ timestamp: '1721600000' }),
      'Invalid timestamp'
    ],
    [
      'missing timestamp',
      withMessage({ timestamp: undefined }),
      'Invalid timestamp'
    ]
  ];

  it.each(invalidBodies)('rejects %s', (name, body, message) => {
    const result = messageRequestSchema.safeParse(body);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(message);
    }
  });
});
