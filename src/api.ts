import express from 'express';
import { hashMessage } from '@ethersproject/hash';
import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import semver from 'semver';
import { getSafeVersion } from './utils';
import db from './mysql';
import pkg from '../package.json';

const router = express.Router();

async function calculateSafeMessageHash(safe, message, chainId = 1) {
  const domain: { verifyingContract: string; chainId?: number } = { verifyingContract: safe, chainId };
  // If safe version is less than 1.3.0, then chainId is not required
  const safeVersion = await getSafeVersion(safe);
  if (semver.lt(safeVersion, '1.3.0')) {
    delete domain.chainId;
  }
  const EIP712_SAFE_MESSAGE_TYPE = {
    SafeMessage: [{ type: 'bytes', name: 'message' }]
  };
  return snapshot.utils.getHash({
    domain,
    types: EIP712_SAFE_MESSAGE_TYPE,
    message: { message }
  });
}

router.get('/', async (req, res) => {
  return res.json({
    name: pkg.name,
    version: pkg.version
  });
});

router.post('/message', async (req, res) => {
  try {
    const msg = JSON.parse(req.body.msg);
    const hash = hashMessage(req.body.msg);
    const address = getAddress(req.body.address);
    const safeHash = await calculateSafeMessageHash(address, hash);
    const params = {
      address,
      hash: safeHash,
      ts: msg.timestamp,
      payload: JSON.stringify(req.body)
    };
    await db.queryAsync('INSERT IGNORE INTO messages SET ?', params);
    console.log('Received', params);
    return res.json({ id: hash });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      error: 'unauthorized',
      error_description: e
    });
  }
});

export default router;
