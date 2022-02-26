import { Contract } from '@ethersproject/contracts';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { hexValue } from '@ethersproject/bytes';
import fetch from 'node-fetch';

async function call(provider, abi, call, options = {}) {
  const contract = new Contract(call[0], abi, provider);
  try {
    const params = call[2] || [];
    return await contract[call[1]](...params, options);
  } catch (e) {
    return Promise.reject(e);
  }
}

export async function getSafeVersion(safe) {
  const networks = await fetch(
    'https://raw.githubusercontent.com/snapshot-labs/snapshot.js/master/src/networks.json'
  ).then(res => res.json());
  const rpc = networks['1'].rpc[0];
  const connectionInfo = typeof rpc === 'object' ? { ...rpc, timeout: 25000 } : { url: rpc, timeout: 25000 };
  const provider = new StaticJsonRpcProvider(connectionInfo);
  const result = await provider.getStorageAt(safe, 0);

  const safeVersionABI = ['function VERSION() view returns (string)'];
  return await call(provider, safeVersionABI, [hexValue(result), 'VERSION', []]);
}
