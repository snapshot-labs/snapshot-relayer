process.env.DATABASE_URL ??=
  'postgres://postgres:postgres@127.0.0.1:5432/snapshot_relayer_test';

const mockCapture = jest.fn();
jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: (...args: any[]) => mockCapture(...args)
}));

describe('db', () => {
  describe('pool error handling', () => {
    it('does not throw when the pool emits an error', async () => {
      const { db } = await import('../../src/db');

      expect(db.$client.listenerCount('error')).toBe(1);
      expect(() =>
        db.$client.emit(
          'error',
          new Error('terminating connection due to administrator command')
        )
      ).not.toThrow();
    });

    it('captures the pool error unchanged, including a 57P01 shutdown', async () => {
      const { db } = await import('../../src/db');
      const err: any = new Error(
        'terminating connection due to administrator command'
      );
      err.code = '57P01';
      err.severity = 'FATAL';

      mockCapture.mockClear();
      db.$client.emit('error', err);

      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith(err);
      expect(mockCapture.mock.calls[0][0].code).toBe('57P01');
    });
  });
});
