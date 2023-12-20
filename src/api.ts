import express from 'express';
import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import { capture } from '@snapshot-labs/snapshot-sentry';
import semver from 'semver';
import { getSafeVersion } from './utils';
import db from './mysql';
// TODO: remove when all environments are updated
import constants from './constants.json';
import { name as packageName, version as packageVersion } from '../package.json';

const router = express.Router();

async function getSpaceNetwork(space, env = 'livenet') {
  const snapshotHubUrl = process.env.HUB_URL || constants[env].api;
  const {
    space: { network }
  } = await snapshot.utils.subgraphRequest(snapshotHubUrl, {
    space: {
      __args: { id: space },
      network: true
    }
  });
  return network;
}

async function calculateSafeMessageHash(safe, message, network = '1') {
  const chainId = parseInt(network);
  const domain: { verifyingContract: string; chainId?: number } = {
    verifyingContract: safe,
    chainId
  };
  // If safe version is less than 1.3.0, then chainId is not required
  const safeVersion = await getSafeVersion(safe, network);
  if (semver.lt(safeVersion, '1.3.0')) delete domain.chainId;
  const EIP712_SAFE_MESSAGE_TYPE = {
    SafeMessage: [{ type: 'bytes', name: 'message' }]
  };
  return snapshot.utils.getHash({
    domain,
    types: EIP712_SAFE_MESSAGE_TYPE,
    message: { message }
  });
}

router.get('/api', async (req, res) => {
  const commit = process.env.COMMIT_HASH || '';
  const version = commit ? `${packageVersion}#${commit.substring(0, 7)}` : packageVersion;
  return res.json({
    name: packageName,
    version
  });
});

router.get('/api/messages/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const results = await db.queryAsync('SELECT * FROM messages WHERE msg_hash = ?', [hash]);
    return res.json(results);
  } catch (e) {
    capture(e);
    return res.status(500).json({
      error: 'oops, something went wrong'
    });
  }
});

router.post('/', async (req, res) => {
  const msg = req.body.data?.message;

  if (!msg) {
    return res.status(400).json({
      error: 'Invalid format request'
    });
  }

  if (!req.body.data.types.Space && !msg.settings && !msg.space) {
    return res.status(400).json({
      error: 'Missing space'
    });
  }

  let address;
  try {
    address = getAddress(req.body.address);
  } catch (e: any) {
    return res.status(400).json({
      error: 'Invalid address'
    });
  }

  try {
    const msgHash = snapshot.utils.getHash(req.body.data);
    const env = 'livenet';
    let network = env === 'livenet' ? '1' : '5';
    if (!req.body.data.types.Space && !msg.settings)
      network = await getSpaceNetwork(msg.space, env);

    const hash = await calculateSafeMessageHash(address, msgHash, network);
    const params = {
      address,
      hash,
      msg_hash: msgHash,
      ts: msg.timestamp,
      payload: JSON.stringify(req.body),
      network,
      env
    };
    await db.queryAsync('INSERT IGNORE INTO messages SET ?', params);
    console.log('Received', params);
    return res.json({ id: msgHash });
  } catch (e) {
    console.log('[EIP721] Unknown error:', e);
    capture(e);
    return res.status(500).json({
      error: 'unauthorized',
      error_description: e
    });
  }
});

router.post('/api/msg', async (req, res) => {
  return res.status(500).json({
    error: 'unauthorized',
    error_description: 'this route is deprecated, please use / instead'
  });
});

export default router;
