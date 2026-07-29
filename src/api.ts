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

class SpaceNotFoundError extends Error {}

async function getSpaceNetwork(space, env = 'mainnet') {
  const snapshotHubUrl = process.env.HUB_URL || constants[env].api;
  // the hub returns { space: null } for an unknown id — destructuring
  // network from it directly would throw and surface as an opaque 500
  const { space: spaceData } = await snapshot.utils.subgraphRequest(
    snapshotHubUrl,
    {
      space: {
        __args: { id: space },
        network: true
      }
    }
  );
  if (!spaceData) throw new SpaceNotFoundError('Unknown space');
  return spaceData.network;
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
  let parsed;
  try {
    parsed = messageRequestSchema.safeParse(req.body);
  } catch (err) {
    // safeParse can throw instead of returning: zod spreads a record key's
    // whole issue array into push(), which overflows the stack on a body with
    // ~100k invalid entries — outside a try that escapes as an unhandled
    // rejection, hanging the request or killing the process
    capture(err);
    return res.status(400).json({
      error: 'Invalid format request'
    });
  }
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid format request',
      // capped: issue count is caller-controlled (one per bad `types` entry),
      // so an unbounded array turns a 200KB body into a ~14MB response.
      // projected so zod's internal issue shape isn't the public contract
      details: parsed.error.issues.slice(0, 20).map(({ path, message }) => ({
        path: path.join('.'),
        message
      }))
    });
  }

  const msg = parsed.data.data.message;
  const address = parsed.data.address;

  let msgHash: string;
  try {
    // hash the raw body, not parsed.data: the stored/relayed payload is
    // serialized from req.body, and hash/payload must never diverge
    msgHash = snapshot.utils.getHash(req.body.data);
  } catch (err) {
    // getHash does no I/O; any throw here is ethers rejecting the EIP-712 shape
    // (missing primary type, unparseable field type, undefined struct ref, ...).
    // Use `reason` (ethers' short fixed-form message), never `message`/`value` —
    // those echo the whole (possibly huge) `types` payload back into the response.
    return res.status(400).json({
      error: 'Invalid format request',
      details: [{ message: (err as any)?.reason ?? 'Invalid EIP-712 data' }]
    });
  }

  try {
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
    if (err instanceof SpaceNotFoundError) {
      return res.status(400).json({
        error: 'Invalid format request',
        details: [{ message: err.message }]
      });
    }
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
