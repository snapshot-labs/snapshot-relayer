import snapshot from '@snapshot-labs/snapshot.js';
import fetch from 'node-fetch';
import db from './mysql';
import subgraphs from './subgraphs.json';
import constants from './constants.json';

const delay = 60 * 60 * 24 * 2;
const interval = 15e3;

interface SubgraphResults {
  sigs?: [{ account: string; msgHash: string }];
}

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
  return new Promise((resolve, reject) => {
    fetch(url, init)
      .then(res => {
        if (res.ok) return resolve(res.json());
        throw res;
      })
      .catch(e => e.json().then(json => reject(json)));
  });
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
    console.log('Failed', network, address, safeHash, e, e?.message);
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
    const safeHashes = messages.map(message => message.hash);
    const query = {
      sigs: {
        __args: {
          first: 1000,
          where: {
            msgHash_in: safeHashes
          }
        },
        account: true,
        msgHash: true
      }
    };

    let results: SubgraphResults = {};
    try {
      results = await snapshot.utils.subgraphRequest(subgraphs[network], query);
    } catch (e) {
      console.log('Subgraph request failed', network, e);
    }
    results.sigs?.forEach(sig => processSig(sig.account, sig.msgHash, network));
  }
  await snapshot.utils.sleep(interval);
  await processSigs(network);
}

setTimeout(() => {
  processSigs('1');
  processSigs('10');
}, interval);
