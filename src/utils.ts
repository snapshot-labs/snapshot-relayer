import { Contract } from '@ethersproject/contracts';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { hexValue } from '@ethersproject/bytes';
import fetch from 'node-fetch';

export async function getSafeVersion(safe) {
  const networks = await fetch(
    'https://raw.githubusercontent.com/snapshot-labs/snapshot.js/master/src/networks.json'
  ).then(res => res.json());
  const rpc = networks['1'].rpc[0];
  const connectionInfo = typeof rpc === 'object' ? { ...rpc, timeout: 25000 } : { url: rpc, timeout: 25000 };
  const provider = new StaticJsonRpcProvider(connectionInfo);
  const storage = await provider.getStorageAt(safe, 0);
  const abi = ['function VERSION() view returns (string)'];
  const contract = new Contract(hexValue(storage), abi, provider);
  return await contract.VERSION([]);
}
