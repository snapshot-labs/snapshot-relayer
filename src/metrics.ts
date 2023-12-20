import init, { client } from '@snapshot-labs/snapshot-metrics';
import { Express } from 'express';
import db from './mysql';

export default function initMetrics(app: Express) {
  init(app, {
    normalizedPath: [['^/api/messages/.+', '/api/messages/#hash']],
    whitelistedPath: [
      /^\/$/,
      /^\/api$/,
      /^\/api\/msg$/,
      /^\/api\/messages\/.+$/
    ]
  });
}

new client.Gauge({
  name: 'messages_per_network_count',
  help: 'Total number of messages per network',
  labelNames: ['network'],
  async collect() {
    const results = await db.queryAsync(
      'SELECT COUNT(*) as count, network FROM messages GROUP BY network'
    );

    results.forEach(result => {
      this.set({ network: result.network }, result.count);
    });
  }
});

export const timeMessageProcess = new client.Histogram({
  name: 'message_process_duration_seconds',
  help: 'Duration in seconds of each batch messages process',
  labelNames: ['network']
});
