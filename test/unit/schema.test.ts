import { insertMessageSchema } from '../../src/schema';

const validParams = {
  address: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3',
  hash: `0x${'ab'.repeat(32)}`,
  msg_hash: `0x${'cd'.repeat(32)}`,
  ts: 1721600000,
  network: '1',
  env: 'mainnet'
};

describe('insertMessageSchema', () => {
  it('accepts valid params', () => {
    expect(insertMessageSchema.safeParse(validParams).success).toBe(true);
  });

  const invalidInputs: [string, Record<string, any>][] = [
    [
      'address without 0x prefix',
      { address: '91FD2c8d24767db4Ece7069AA27832ffaf8590f3aa' }
    ],
    [
      'address too short',
      { address: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f' }
    ],
    [
      'address too long',
      { address: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3a' }
    ],
    [
      'address with non-hex chars',
      { address: '0x91FD2c8d24767db4Ece7069AA27832ffaf8590zz' }
    ],
    ['hash too short', { hash: `0x${'ab'.repeat(31)}` }],
    ['hash too long', { hash: `0x${'ab'.repeat(33)}` }],
    ['hash with non-hex chars', { hash: `0x${'zz'.repeat(32)}` }],
    ['msg_hash too short', { msg_hash: `0x${'cd'.repeat(31)}` }],
    ['msg_hash with non-hex chars', { msg_hash: `0x${'zz'.repeat(32)}` }],
    ['network longer than 24 chars', { network: 'a'.repeat(25) }],
    ['empty network', { network: '' }],
    ['env longer than 24 chars', { env: 'a'.repeat(25) }],
    ['empty env', { env: '' }],
    ['negative ts', { ts: -1 }],
    ['zero ts', { ts: 0 }],
    ['non-integer ts', { ts: 1721600000.5 }],
    ['string ts', { ts: '1721600000' }],
    ['missing ts', { ts: undefined }]
  ];

  it.each(invalidInputs)('rejects %s', (name, override) => {
    const result = insertMessageSchema.safeParse({
      ...validParams,
      ...override
    });
    expect(result.success).toBe(false);
  });
});
