import express from 'express';
import { hashMessage } from '@ethersproject/hash';
import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import fetch from 'node-fetch';
import db from './mysql';

const router = express.Router();

async function calculateSafeMessageHash(safe, message, chainId = 1) {
  const domain: { verifyingContract: string; chainId?: number } = { verifyingContract: safe };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let safeResponse: any = null;
  try {
    safeResponse = await fetch(`https://safe-transaction.mainnet.gnosis.io/api/v1/safes/${safe}`).then(res =>
      res.json()
    );
  } catch (e) {
    console.log(e);
    domain.chainId = chainId;
  }
  if (safeResponse?.version !== '1.1.1') {
    domain.chainId = chainId;
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
