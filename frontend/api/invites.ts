import { getAddress, id } from "ethers";

type ApiRequest = { query?: Record<string, string | string[] | undefined> };
type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

type RpcLog = {
  blockNumber: string;
  logIndex: string;
  topics: string[];
};

const ALLOWED_TOPIC = id("WalletAllowed(address)").toLowerCase();
const REMOVED_TOPIC = id("WalletRemoved(address)").toLowerCase();
const START_BLOCK = Number.parseInt(process.env.PRIVATE_VAULT_START_BLOCK ?? "48926993", 10);
const BLOCK_CHUNK = 5_000;
const RPC_URLS = [
  process.env.EVENT_RPC_URL,
  process.env.VITE_EVENT_RPC_URL,
  "https://base.gateway.tenderly.co",
  "https://mainnet.base.org",
].filter((url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index);

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const payload = await response.json() as { result?: T; error?: { message?: string } };
  if (payload.error || payload.result === undefined) throw new Error(payload.error?.message ?? "Invalid RPC response");
  return payload.result;
}

async function readInvitedWallets(url: string, vault: string) {
  const latestHex = await rpc<string>(url, "eth_blockNumber", []);
  const latestBlock = Number.parseInt(latestHex, 16);
  const logs: RpcLog[] = [];

  for (let fromBlock = START_BLOCK; fromBlock <= latestBlock; fromBlock += BLOCK_CHUNK) {
    const toBlock = Math.min(fromBlock + BLOCK_CHUNK - 1, latestBlock);
    logs.push(...await rpc<RpcLog[]>(url, "eth_getLogs", [{
      address: vault,
      topics: [[ALLOWED_TOPIC, REMOVED_TOPIC]],
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
    }]));
  }

  logs.sort((a, b) => Number.parseInt(a.blockNumber, 16) - Number.parseInt(b.blockNumber, 16)
    || Number.parseInt(a.logIndex, 16) - Number.parseInt(b.logIndex, 16));
  const wallets = new Map<string, string>();
  for (const log of logs) {
    if (!log.topics[1]) continue;
    const wallet = getAddress(`0x${log.topics[1].slice(-40)}`);
    const key = wallet.toLowerCase();
    if (log.topics[0]?.toLowerCase() === ALLOWED_TOPIC) wallets.set(key, wallet);
    else if (log.topics[0]?.toLowerCase() === REMOVED_TOPIC) wallets.delete(key);
  }
  return [...wallets.values()];
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const rawVault = Array.isArray(request.query?.vault) ? request.query?.vault[0] : request.query?.vault;
  if (!rawVault || !/^0x[0-9a-fA-F]{40}$/.test(rawVault)) {
    return response.status(400).json({ error: "Invalid Market address" });
  }

  const vault = getAddress(rawVault);
  for (const url of RPC_URLS) {
    try {
      const wallets = await readInvitedWallets(url, vault);
      response.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=60");
      return response.status(200).json({ wallets });
    } catch (error) {
      console.error("Invite history RPC failed", url, error);
    }
  }
  return response.status(503).json({ error: "Invite history is temporarily unavailable" });
}
