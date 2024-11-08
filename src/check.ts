import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
// TODO: remove when all environments are updated
import constants from './constants.json';
import { timeMessageProcess } from './metrics';
import db from './mysql';
import { fetchWithKeepAlive } from './utils';

const delay = 60 * 60 * 24 * 3;
const interval = 15e3;
const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

const SUPPORTED_NETWORKS = [
  '1',
  '10',
  '56',
  '100',
  '137',
  '250',
  '42161',
  '1088',
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
  const res = await fetchWithKeepAlive(url, init);
  return res.json();
}

async function processSig(address, safeHash, network) {
  const query =
    'SELECT * FROM messages WHERE address = ? AND hash = ? AND network = ? LIMIT 1';
  const [message] = await db.queryAsync(query, [address, safeHash, network]);
  console.log('Process sig', network, address, safeHash);
  try {
    const result: any = await send(message.payload);
    if (
      result.error_description &&
      errorMessagesWhitelist.includes(result.error_description)
    ) {
      console.log('[processSig] Error', network, address, safeHash, result);
      return;
    }
    await db.queryAsync(
      'DELETE FROM messages WHERE address = ? AND hash = ? AND network = ? LIMIT 1',
      [address, safeHash, network]
    );
    console.log(
      '[processSig] Sent message for',
      network,
      address,
      safeHash,
      result
    );
  } catch (e) {
    capture(e, { address, safeHash, network });
    // @ts-ignore
    console.log(
      '[processSig] Failed',
      network,
      address,
      safeHash,
      e,
      (e as any)?.message
    );
  }
}

async function checkSignedMessages(messages, network) {
  if (messages.length > 0) {
    const end = timeMessageProcess.startTimer({ network });
    const provider = snapshot.utils.getProvider(network, { broviderUrl });
    const abi = ['function signedMessages(bytes32) view returns (uint256)'];
    try {
      const response = await snapshot.utils.multicall(
        network,
        provider,
        abi,
        messages.map(message => [
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
          processSig(messages[index].address, messages[index].hash, network)
      );
    } catch (e) {
      capture(e, { messages, network });
      console.log(`multicall error for network: ${network}`, e);
    } finally {
      end();
    }
  }
}

async function processSigs() {
  console.log('Process all sigs');

  // Get all messages from last 3 days and filter by supported networks
  const ts = parseInt((Date.now() / 1e3).toFixed()) - delay;
  let messages = await db.queryAsync('SELECT * FROM messages WHERE ts > ?', [
    ts
  ]);
  messages = messages.filter(message =>
    SUPPORTED_NETWORKS.includes(message.network)
  );
  console.log('Total messages waiting: ', messages.length);

  // Divide messages by network
  const messagesByNetwork = messages.reduce((acc, message) => {
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

  // Wait and process again
  await snapshot.utils.sleep(interval);
  processSigs();
}

processSigs();
