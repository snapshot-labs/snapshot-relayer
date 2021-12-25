import express from 'express';
import { hashMessage } from '@ethersproject/hash';
import { getAddress } from '@ethersproject/address';
import db from './mysql';

const router = express.Router();

router.post('/message', async (req, res) => {
  try {
    const msg = JSON.parse(req.body.msg);
    const params = {
      address: getAddress(req.body.address),
      hash: hashMessage(req.body.msg),
      ts: msg.timestamp,
      payload: JSON.stringify(req.body)
    };
    await db.queryAsync('INSERT IGNORE INTO messages SET ?', params);
    console.log(params);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({
      error: 'unauthorized',
      error_description: e
    });
  }
});

export default router;
