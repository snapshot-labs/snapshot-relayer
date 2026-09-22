import { Contract } from '@ethersproject/contracts';
import snapshot from '@snapshot-labs/snapshot.js';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export async function getSafeVersion(safe, network) {
  const provider = snapshot.utils.getProvider(network, {
    broviderUrl,
    clientName: 'snapshot-relayer'
  });
  const abi = ['function VERSION() view returns (string)'];
  const contract = new Contract(safe, abi, provider);

  return await contract.VERSION();
}
