import snapshot from '@snapshot-labs/snapshot.js';
import fetch from 'node-fetch';
import db from './mysql';
import constants from './constants.json';

const delay = 60 * 60 * 24 * 3;
const interval = 15e3;

async function send(body, env = 'livenet') {
  const url = constants[env].ingestor;
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
  const query = 'SELECT * FROM messages WHERE address = ? AND hash = ? AND network = ? LIMIT 1';
  const [message] = await db.queryAsync(query, [address, safeHash, network]);
  console.log('Process sig', network, address, safeHash);
  try {
    const result = await send(message.payload);
    await db.queryAsync(
      'DELETE FROM messages WHERE address = ? AND hash = ? AND network = ? LIMIT 1',
      [address, safeHash, network]
    );
    console.log('Sent message for', network, address, safeHash, result);
  } catch (e) {
    // @ts-ignore
    console.log('[processSig] Failed', network, address, safeHash, e, e?.message);
  }
}

async function processSigs(network = '1') {
  console.log('Process sigs', network);
  const ts = parseInt((Date.now() / 1e3).toFixed()) - delay;
  const messages = await db.queryAsync('SELECT * FROM messages WHERE ts > ? AND network = ?', [
    ts,
    network
  ]);
  console.log('Standby', network, messages.length);
  if (messages.length > 0) {
    const provider = snapshot.utils.getProvider(network);
    const abi = ['function signedMessages(bytes32) view returns (uint256)'];
    try {
      const response = await snapshot.utils.multicall(
        network,
        provider,
        abi,
        messages.map(message => [message.address, 'signedMessages', [message.hash]]),
        {
          blockTag: 'latest'
        }
      );
      response?.forEach(
        (res, index) =>
          res.toString() === '1' &&
          processSig(messages[index].address, messages[index].hash, network)
      );
    } catch (error) {
      console.log('multicall error', error);
    }
  }
  await snapshot.utils.sleep(interval);
  await processSigs(network);
}

setTimeout(() => {
  processSigs('1');
  processSigs('10');
  processSigs('137');
}, interval);
