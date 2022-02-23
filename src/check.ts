import snapshot from '@snapshot-labs/snapshot.js';
import fetch from 'node-fetch';
import db from './mysql';

const subgraphUrl = 'https://api.thegraph.com/subgraphs/name/snapshot-labs/snapshot';
const hubUrl = 'https://hub.snapshot.org';
const delay = 60 * 60 * 24 * 2;
const interval = 15e3;

async function send(body) {
  const url = `${hubUrl}/api/message`;
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

async function processSig(address, safeHash) {
  const query = 'SELECT * FROM messages WHERE address = ? AND hash = ? LIMIT 1';
  const [message] = await db.queryAsync(query, [address, safeHash]);
  console.log('Process sig', address, safeHash);
  try {
    const result = await send(message.payload);
    await db.queryAsync('DELETE FROM messages WHERE address = ? AND hash = ? LIMIT 1', [address, safeHash]);
    console.log('Sent message for', address, safeHash, result);
  } catch (e) {
    console.log('Failed', address, safeHash, e);
  }
}

async function processSigs() {
  console.log('Process sigs');
  const ts = parseInt((Date.now() / 1e3).toFixed()) - delay;
  const messages = await db.queryAsync('SELECT * FROM messages WHERE ts > ?', ts);
  console.log('Standby', messages.length);
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
    try {
      const results = await snapshot.utils.subgraphRequest(subgraphUrl, query);
      results.sigs.forEach(sig => processSig(sig.account, sig.msgHash));
    } catch (error) {
      console.log(error);
    }
  }
  await snapshot.utils.sleep(interval);
  await processSigs();
}

setTimeout(async () => await processSigs(), interval);
