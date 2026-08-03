import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { and, eq, gt, inArray } from 'drizzle-orm';
// TODO: remove when all environments are updated
import constants from './constants.json';
import { db } from './db';
import { timeMessageProcess } from './metrics';
import { messages } from './schema';

const delay = 60 * 60 * 24 * 6; // 6 days
const interval = 15e3;
const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

const SUPPORTED_NETWORKS = [
  '1',
  '10',
  '56',
  '100',
  '137',
  '146',
  '250',
  '1088',
  '8453',
  '33139',
  '42161',
  '11155111'
];

const errorMessagesWhitelist = [
  'signature validation failed',
  'pinning failed',
  'failed store settings',
  'failed to check validation',
  'failed to check proposals limit',
  'failed to check vote validation',
  'failed to check voting power',
  'update in progress, try later',
  'unable to fetch block'
];

async function send(body, env = 'mainnet') {
  const url = process.env.SEQUENCER_URL || constants[env].ingestor;
  const init = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body
  };
  const res = await fetch(url, init);
  return res.json();
}

async function processSig(address, safeHash, network) {
  const filter = and(
    eq(messages.address, address),
    eq(messages.hash, safeHash),
    eq(messages.network, network)
  );
  try {
    const message = await db.query.messages.findFirst({ where: filter });
    if (!message) return;
    console.log('Process sig', network, address, safeHash);
    const result: any = await send(message.payload);
    if (
      result.error_description &&
      errorMessagesWhitelist.includes(result.error_description)
    ) {
      console.log('[processSig] Error', network, address, safeHash, result);
      return;
    }
    await db.delete(messages).where(filter);
    console.log(
      '[processSig] Sent message for',
      network,
      address,
      safeHash,
      result
    );
  } catch (err) {
    capture(err, { address, safeHash, network });
    // @ts-ignore
    console.log(
      '[processSig] Failed',
      network,
      address,
      safeHash,
      err,
      (err as any)?.message
    );
  }
}

export async function checkSignedMessages(pendingMessages, network) {
  if (pendingMessages.length > 0) {
    const end = timeMessageProcess.startTimer({ network });
    const provider = snapshot.utils.getProvider(network, { broviderUrl });
    const abi = ['function signedMessages(bytes32) view returns (uint256)'];
    try {
      const response = await snapshot.utils.multicall(
        network,
        provider,
        abi,
        pendingMessages.map(message => [
          message.address,
          'signedMessages',
          [message.hash]
        ]),
        {
          blockTag: 'latest'
        }
      );
      console.log(
        `Network: ${network} - Valid: ${
          response.filter(r => r.toString() === '1').length
        } - Invalid: ${response.filter(r => r.toString() === '0').length}`
      );
      response?.forEach(
        (res, index) =>
          res.toString() === '1' &&
          processSig(
            pendingMessages[index].address,
            pendingMessages[index].hash,
            network
          )
      );
    } catch (err) {
      capture(err, { messages: pendingMessages, network });
      console.log(`multicall error for network: ${network}`, err);
    } finally {
      end();
    }
  }
}

export async function processSigs() {
  console.log('Process all sigs');

  try {
    // Get all messages from last 6 days and filter by supported networks
    const ts = parseInt((Date.now() / 1e3).toFixed()) - delay;
    const pending = await db.query.messages.findMany({
      columns: { address: true, hash: true, network: true },
      where: and(
        gt(messages.ts, ts),
        inArray(messages.network, SUPPORTED_NETWORKS)
      )
    });
    console.log('Total messages waiting: ', pending.length);

    // Divide messages by network
    const messagesByNetwork = pending.reduce((acc, message) => {
      if (!acc[message.network]) acc[message.network] = [];
      acc[message.network].push(message);
      return acc;
    }, {});
    Object.keys(messagesByNetwork).forEach(m =>
      console.log(`Network: ${m} - Standby: ${messagesByNetwork[m].length};`)
    );

    // Process messages by network
    await Promise.all(
      Object.keys(messagesByNetwork).map(network =>
        checkSignedMessages(messagesByNetwork[network], network)
      )
    );
    console.log('Done');
  } catch (err) {
    capture(err);
    console.log('[processSigs] Failed', err);
  }

  // Wait and process again
  await snapshot.utils.sleep(interval);
  processSigs();
}
