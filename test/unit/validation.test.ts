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
  const validBodies: [string, any][] = [
    ['a valid body', validBody],
    [
      'a body with types.Space and no message.space',
      {
        ...validBody,
        data: { types: { Space: [] }, message: { timestamp: 1721600000 } }
      }
    ],
    [
      'a body with message.settings and no message.space',
      withMessage({ space: undefined, settings: {} })
    ],
    ['the maximum timestamp', withMessage({ timestamp: 10_000_000_000 })],
    // types entries are getHash's job, not the schema's
    [
      'a non-array types value',
      { ...validBody, data: { ...validBody.data, types: { Vote: 'bad' } } }
    ],
    [
      'a types field missing name',
      {
        ...validBody,
        data: { ...validBody.data, types: { Vote: [{ type: 'string' }] } }
      }
    ]
  ];

  it.each(validBodies)('accepts %s', (_name, body) => {
    expect(messageRequestSchema.safeParse(body).success).toBe(true);
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
    expect(messageRequestSchema.safeParse(body).data).toEqual(body);
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
    ['timestamp above the maximum', withMessage({ timestamp: 10_000_000_001 })],
    [
      'missing timestamp',
      {
        ...validBody,
        data: { ...validBody.data, message: { space: 'test.eth' } }
      }
    ],
    [
      'non-object types',
      { ...validBody, data: { ...validBody.data, types: 'nope' } }
    ],
    ['array types', { ...validBody, data: { ...validBody.data, types: [] } }]
  ];

  it.each(invalidBodies)('rejects %s', (_name, body) => {
    expect(messageRequestSchema.safeParse(body).success).toBe(false);
  });

  it('reports missing space as an issue', () => {
    const result = messageRequestSchema.safeParse(
      withMessage({ space: undefined })
    );
    expect(result.error?.issues.map(i => i.message)).toContain('Missing space');
  });
});
