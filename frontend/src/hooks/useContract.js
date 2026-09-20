/**
 * useContract —— 只读 Provider 与 Signer 的分离点。
 *
 * 未连钱包时也要能浏览活动列表，所以 readProvider 有一个公共 RPC 兜底；
 * 写操作必须有 signer，没有就返回 null（UI 据此禁用按钮）。
 */
import { useMemo } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import { CONTRACT_ADDRESS, SEPOLIA_RPC_URL, TICKET_ABI } from "../lib/contract";

export function useContract(wallet) {
  const readProvider = useMemo(
    () => wallet.provider ?? new JsonRpcProvider(SEPOLIA_RPC_URL),
    [wallet.provider]
  );

  const readContract = useMemo(
    () => (CONTRACT_ADDRESS ? new Contract(CONTRACT_ADDRESS, TICKET_ABI, readProvider) : null),
    [readProvider]
  );

  const writeContract = useMemo(
    () =>
      CONTRACT_ADDRESS && wallet.signer
        ? new Contract(CONTRACT_ADDRESS, TICKET_ABI, wallet.signer)
        : null,
    [wallet.signer]
  );

  return { readProvider, readContract, writeContract, contractReady: Boolean(readContract) };
}
