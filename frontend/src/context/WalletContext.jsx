import { createContext, useContext } from "react";
import { useWallet } from "../hooks/useWallet";

const WalletContext = createContext(null);

/** 全局注入钱包状态，避免 props 层层透传 */
export function WalletProvider({ children }) {
  const wallet = useWallet();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext 必须在 <WalletProvider> 内部使用");
  return ctx;
}
