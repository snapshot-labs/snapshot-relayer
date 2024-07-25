import https from 'node:https';
import { hexValue } from '@ethersproject/bytes';
import { Contract } from '@ethersproject/contracts';
import snapshot from '@snapshot-labs/snapshot.js';
import fetch from 'node-fetch';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export async function getSafeVersion(safe, network) {
  const provider = snapshot.utils.getProvider(network, { broviderUrl });
  const storage = await provider.getStorageAt(safe, 0);
  const abi = ['function VERSION() view returns (string)'];
  const contract = new Contract(hexValue(storage), abi, provider);
  return await contract.VERSION([]);
}

const httpsAgent = new https.Agent({ keepAlive: true });

export const fetchWithKeepAlive = (uri: any, options: any = {}) => {
  return fetch(uri, { agent: httpsAgent, ...options });
};
