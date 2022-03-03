import { Contract } from '@ethersproject/contracts';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { hexValue } from '@ethersproject/bytes';
import fetch from 'node-fetch';

export async function getSafeVersion(safe) {
  const provider = new StaticJsonRpcProvider('https://rpc.ankr.com/eth');
  const storage = await provider.getStorageAt(safe, 0);
  const abi = ['function VERSION() view returns (string)'];
  const contract = new Contract(hexValue(storage), abi, provider);
  return await contract.VERSION([]);
}
