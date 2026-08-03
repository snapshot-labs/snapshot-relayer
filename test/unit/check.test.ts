process.env.DATABASE_URL ??=
  'postgres://postgres:postgres@127.0.0.1:5432/snapshot_relayer_test';

const mockCapture = jest.fn();
jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: (...args: any[]) => mockCapture(...args)
}));

const mockFindFirst = jest.fn();
const mockDeleteWhere = jest.fn();
jest.mock('../../src/db', () => ({
  db: {
    query: {
      messages: { findFirst: (...args: any[]) => mockFindFirst(...args) }
    },
    delete: () => ({ where: (...args: any[]) => mockDeleteWhere(...args) })
  }
}));

jest.mock('../../src/metrics', () => ({
  timeMessageProcess: { startTimer: () => () => undefined }
}));

const mockMulticall = jest.fn();
jest.mock('@snapshot-labs/snapshot.js', () => ({
  __esModule: true,
  default: {
    utils: {
      getProvider: () => ({}),
      multicall: (...args: any[]) => mockMulticall(...args),
      sleep: () => Promise.resolve()
    }
  }
}));

import { checkSignedMessages } from '../../src/check';

const pending = [{ address: '0xabc', hash: '0xdead', network: '1' }];

async function flush() {
  for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
}

async function withRejectionWatch(fn: () => Promise<void>) {
  const seen: unknown[] = [];
  const onRejection = (reason: unknown) => seen.push(reason);
  process.on('unhandledRejection', onRejection);
  try {
    await fn();
    await flush();
  } finally {
    process.off('unhandledRejection', onRejection);
  }
  return seen;
}

describe('checkSignedMessages', () => {
  beforeEach(() => {
    mockMulticall.mockResolvedValue(['1']);
    mockDeleteWhere.mockResolvedValue(undefined);
    global.fetch = jest
      .fn()
      .mockResolvedValue({ json: async () => ({}) }) as any;
  });

  it('reports a db failure on the first query with the message context', async () => {
    const dbError = new Error('relation "messages" does not exist');
    mockFindFirst.mockRejectedValue(dbError);

    const rejections = await withRejectionWatch(() =>
      checkSignedMessages(pending, '1')
    );

    expect(rejections).toEqual([]);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(dbError, {
      address: '0xabc',
      safeHash: '0xdead',
      network: '1'
    });
  });

  it('relays and deletes a message that is signed on-chain', async () => {
    mockFindFirst.mockResolvedValue({ payload: '{}' });

    const rejections = await withRejectionWatch(() =>
      checkSignedMessages(pending, '1')
    );

    expect(rejections).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('does nothing when the message is already gone', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const rejections = await withRejectionWatch(() =>
      checkSignedMessages(pending, '1')
    );

    expect(rejections).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockDeleteWhere).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('skips messages that are not signed on-chain', async () => {
    mockMulticall.mockResolvedValue(['0']);
    mockFindFirst.mockResolvedValue({ payload: '{}' });

    const rejections = await withRejectionWatch(() =>
      checkSignedMessages(pending, '1')
    );

    expect(rejections).toEqual([]);
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
