import { Contract } from '@ethersproject/contracts';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { hexValue } from '@ethersproject/bytes';

export async function getSafeVersion(safe) {
  const provider = new StaticJsonRpcProvider('https://brovider.xyz/1');
  const storage = await provider.getStorageAt(safe, 0);
  const abi = ['function VERSION() view returns (string)'];
  const contract = new Contract(hexValue(storage), abi, provider);
  return await contract.VERSION([]);
}
