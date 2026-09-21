/**
 * WalletContext —— 把 useWallet 的状态挂到 Context 上，避免 props 层层透传。
 *
 * <WalletProvider> 是公开接口的一部分（见 shared/wallet/src/index.js）。
 * 一个页面只需要在根部包一次，内部任意组件用 useWalletContext() 取钱包。
 *
 * 注意：这里没有做「登录态持久化」——因为钱包本身不产生会话 token，
 * 持久化由钱包（站点授权）负责，刷新页面靠 useWallet 里的 eth_accounts 静默恢复。
 */
import { createContext, useContext } from "react";
import { useWallet } from "../hooks/useWallet";

const WalletContext = createContext(null);

/** 全局注入钱包状态 */
export function WalletProvider({ children }) {
  const wallet = useWallet();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext 必须在 <WalletProvider> 内部使用");
  return ctx;
}
