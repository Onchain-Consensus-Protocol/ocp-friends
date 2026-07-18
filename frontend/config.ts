const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

export const config = {
  privateVaultFactoryAddress: env?.VITE_PRIVATE_VAULT_FACTORY_ADDRESS ?? "0x0000000000000000000000000000000000000000",
  depositTokenAddress: env?.VITE_DEPOSIT_TOKEN_ADDRESS ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  chainId: parseInt(env?.VITE_CHAIN_ID ?? "8453", 10),
  rpcUrl: env?.VITE_RPC_URL ?? "https://mainnet.base.org",
  explorer: env?.VITE_EXPLORER ?? "https://basescan.org",
};

export const PRIVATE_VAULT_ABI = [
  "function factory() view returns (address)", "function creator() view returns (address)",
  "function stakeToken() view returns (address)", "function resolutionMode() view returns (uint8)",
  "function stakeEndTime() view returns (uint256)", "function resolutionDeadline() view returns (uint256)",
  "function minStake() view returns (uint256)", "function allowedWallets(address) view returns (bool)",
  "function hasParticipated(address) view returns (bool)", "function totalPrincipal() view returns (uint256)",
  "function totalStakeYes() view returns (uint256)", "function totalStakeNo() view returns (uint256)",
  "function totalStakeInvalid() view returns (uint256)",
  "function stakeOf(address) view returns (uint256 yes, uint256 no, uint256 invalidAmount)",
  "function finalized() view returns (bool)", "function resolvedOutcome() view returns (uint8)",
  "function settlementPool() view returns (uint256)", "function hasClaimed(address) view returns (bool)",
  "function stake(uint8 side, uint256 amount)", "function addAllowedWallets(address[] wallets)",
  "function removeAllowedWallet(address wallet)", "function finalizeByCoreRules()",
  "function resolveByCreator(uint8 outcome)", "function finalizeExpiredResolution()", "function withdraw()",
] as const;
export const PRIVATE_VAULT_FACTORY_ABI = [
  "function createPrivateVault((string claim,string description,address stakeToken,uint8 resolutionMode,uint256 stakePeriod,uint256 resolutionPeriod,uint256 minStake,address[] allowedWallets) params) returns (address vault)",
  "function getPrivateVaultMeta(address vault) view returns (string claim, string description)",
  "function getCreatorPrivateVaults(address creator) view returns (address[])",
  "function getAllPrivateVaults() view returns (address[])", "function isPrivateVault(address vault) view returns (bool)",
  "function MAX_ALLOWED_WALLETS() view returns (uint256)",
  "event PrivateVaultCreated(address indexed vault,address indexed creator,uint8 resolutionMode,uint256 stakeEndTime)",
] as const;

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)", "function symbol() view returns (string)",
] as const;
