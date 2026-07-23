import { messageRequestSchema } from '../../src/validation';

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

  it('preserves unknown keys at every level', () => {
    const body = {
      ...validBody,
      sig: '0x00',
      data: {
        ...validBody.data,
        domain: { name: 'snapshot' },
        message: { ...validBody.data.message, choice: 1 }
      }
    };
    const result = messageRequestSchema.safeParse(body);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(body);
    }
  });

  it('accepts a body with types.Space and no message.space', () => {
    const body = {
      ...validBody,
      data: { types: { Space: [] }, message: { timestamp: 1721600000 } }
    };
    expect(messageRequestSchema.safeParse(body).success).toBe(true);
  });

  const invalidBodies: [string, any][] = [
    ['missing body', undefined],
    [
      'missing data.message',
      { address: validBody.address, data: { types: {} } }
    ],
    [
      'missing data.types',
      { address: validBody.address, data: { message: validBody.data.message } }
    ],
    ['malformed address', { ...validBody, address: '0xdeadbeef' }],
    [
      'non-checksummed (lowercase) address',
      { ...validBody, address: '0x91fd2c8d24767db4ece7069aa27832ffaf8590f3' }
    ],
    [
      'address with invalid checksum',
      { ...validBody, address: '0x91fD2c8d24767db4Ece7069AA27832ffaf8590f3' }
    ],
    ['missing address', { data: validBody.data }],
    ['negative timestamp', withMessage({ timestamp: -1 })],
    ['zero timestamp', withMessage({ timestamp: 0 })],
    ['non-integer timestamp', withMessage({ timestamp: 1721600000.5 })],
    ['timestamp in milliseconds', withMessage({ timestamp: 1721600000000 })],
    ['string timestamp', withMessage({ timestamp: '1721600000' })],
    ['missing timestamp', withMessage({ timestamp: undefined })]
  ];

  it.each(invalidBodies)('rejects %s', (name, body) => {
    expect(messageRequestSchema.safeParse(body).success).toBe(false);
  });

  it('reports missing space as an issue', () => {
    const result = messageRequestSchema.safeParse(
      withMessage({ space: undefined })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Missing space');
    }
  });
});
