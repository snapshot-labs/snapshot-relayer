// node-postgres opens connections lazily, so building the pool here does not
// need a live database.
process.env.DATABASE_URL ??=
  'postgres://postgres:postgres@127.0.0.1:5432/snapshot_relayer_test';

describe('db', () => {
  describe('pool error handling', () => {
    it('does not throw when the pool emits an error', async () => {
      const log = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      const { db } = await import('../../src/db');

      // A pooled connection killed server-side while idle is re-emitted by
      // pg-pool as an 'error' event on the pool. EventEmitter rethrows that
      // event when nothing listens for it, which takes the process down.
      expect(db.$client.listenerCount('error')).toBe(1);
      expect(() =>
        db.$client.emit(
          'error',
          new Error('terminating connection due to administrator command')
        )
      ).not.toThrow();
      expect(log).toHaveBeenCalled();

      log.mockRestore();
    });
  });
});
