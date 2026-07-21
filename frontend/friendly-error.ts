type ErrorRecord = Record<string, unknown>;

function collectErrorText(reason: unknown): string {
  if (typeof reason === "string") return reason;
  if (!reason || typeof reason !== "object") return String(reason ?? "");
  const error = reason as ErrorRecord;
  const info = error.info && typeof error.info === "object" ? error.info as ErrorRecord : {};
  const nested = info.error && typeof info.error === "object" ? info.error as ErrorRecord : {};
  const revert = error.revert && typeof error.revert === "object" ? error.revert as ErrorRecord : {};
  return [error.reason, error.shortMessage, error.message, nested.message, revert.args, error.code]
    .filter(Boolean).map(String).join(" ");
}

export function friendlyError(reason: unknown, zh: boolean): string {
  const raw = collectErrorText(reason).toLowerCase();
  const match = (text: string) => raw.includes(text.toLowerCase());
  if (match("unsupported stake token") || match("factory stake token does not match")) return zh ? "这个 Factory 只支持当前网络的官方 USDC。" : "This Factory supports only the official USDC on the current network.";
  if (match("position is locked to one side")) return zh
    ? "你已经选择了另一个选项。同一个 Market 中不能更换选项，只能继续增加原选项的金额。"
    : "You already selected another option in this Market. You cannot switch sides, but you can add to your original choice.";
  if (match("action_rejected") || match("user rejected") || match("4001")) return zh ? "你已在钱包中取消操作。" : "You cancelled the action in your wallet.";
  if (match("insufficient funds")) return zh ? "钱包余额不足，无法支付金额或网络手续费。" : "Your wallet does not have enough funds for the amount or network fee.";
  if (match("wallet not invited") || match("not allowed")) return zh ? "当前钱包不在这个 Market 的邀请名单中。" : "This wallet is not on the Market invite list.";
  if (match("staking ended")) return zh ? "参与时间已经结束。" : "The staking period has ended.";
  if (match("amount below min stake")) return zh ? "输入金额低于最低参与金额。" : "The amount is below the minimum stake.";
  if (match("no yes stake")) return zh ? "YES 当前无人持仓，不能结算为 YES。请选择有持仓的一方或 INVALID。" : "YES has no holders. Choose a side with holders or INVALID.";
  if (match("no no stake")) return zh ? "NO 当前无人持仓，不能结算为 NO。请选择有持仓的一方或 INVALID。" : "NO has no holders. Choose a side with holders or INVALID.";
  if (match("too many decimals") || match("underflow") || match("invalid decimal") || match("invalid fixednumber")) return zh ? "请输入有效金额；USDC 最多支持 6 位小数。" : "Enter a valid amount. USDC supports up to 6 decimal places.";
  if (match("already finalized") || match("already resolved")) return zh ? "这个 Market 已经完成结算。" : "This Market has already been finalized.";
  if (match("already claimed")) return zh ? "你已经领取过资金。" : "You have already claimed your payout.";
  if (match("only creator")) return zh ? "只有创建者可以执行此操作。" : "Only the creator can perform this action.";
  if (match("resolution period expired")) return zh ? "创建者提交结果的时间已经结束。" : "The creator resolution period has ended.";
  if (match("wrong network") || match("chain mismatch") || match("unsupported chain")) return zh ? "钱包网络不正确，请切换到当前网站配置的 Base 网络。" : "Your wallet is on the wrong network. Switch to the Base network configured by this site.";
  return zh
    ? "操作失败。请确认钱包网络、余额和当前 Market 状态后重试。"
    : "The action could not be completed. Check your wallet network, balance, and the current Market status, then try again.";
}
