import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { eq } from 'drizzle-orm';
import express from 'express';
import semver from 'semver';
import constants from './constants.json';
import { db } from './db';
import { messages } from './schema';
// TODO: remove when all environments are updated
import { getSafeVersion } from './utils';
import { messageRequestSchema } from './validation';
import {
  name as packageName,
  version as packageVersion
} from '../package.json';

const router = express.Router();

async function getSpaceNetwork(space, env = 'mainnet') {
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
  const version = commit
    ? `${packageVersion}#${commit.substring(0, 7)}`
    : packageVersion;
  return res.json({
    name: packageName,
    version
  });
});

router.get('/api/messages/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const results = await db.query.messages.findMany({
      where: eq(messages.msg_hash, hash)
    });
    return res.json(results);
  } catch (err) {
    capture(err);
    return res.status(500).json({
      error: 'oops, something went wrong'
    });
  }
});

router.post('/', async (req, res) => {
  const parsed = messageRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid format request',
      details: parsed.error.issues
    });
  }

  const msg = parsed.data.data.message;
  const address = parsed.data.address;

  try {
    // hash and payload use the raw body verbatim; parsed.data strips unknown keys
    const msgHash = snapshot.utils.getHash(req.body.data);
    const env = 'mainnet';
    let network = env === 'mainnet' ? '1' : '5';
    if (!parsed.data.data.types.Space && !msg.settings)
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
    await db.insert(messages).values(params).onConflictDoNothing();
    console.log('Received', params);
    return res.json({ id: msgHash });
  } catch (err) {
    console.log('[EIP721] Unknown error:', err);
    capture(err);
    return res.status(500).json({
      error: 'unauthorized',
      error_description: err
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
