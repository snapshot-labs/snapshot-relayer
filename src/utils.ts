import { Contract } from '@ethersproject/contracts';
import { hexValue } from '@ethersproject/bytes';
import snapshot from '@snapshot-labs/snapshot.js';

export async function getSafeVersion(safe, network) {
  const provider = snapshot.utils.getProvider(network, { broviderUrl: process.env.BROVIDER_URL });
  const storage = await provider.getStorageAt(safe, 0);
  const abi = ['function VERSION() view returns (string)'];
  const contract = new Contract(hexValue(storage), abi, provider);
  return await contract.VERSION([]);
}
