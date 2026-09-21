/**
 * useContract —— 只读 Provider 与 Signer 的分离点。
 *
 * 这就是「业务层基于钱包接口实现」的范例：
 *   - 钱包模块只给 provider / signer / account / ensureSepolia，它不认识 TicketNFT；
 *   - 合约地址与 ABI 属于业务，留在这里；
 *   - 于是「换合约」不用动钱包模块，「换钱包」也不用动合约代码。
 *
 * 未连钱包时也要能浏览活动列表，所以 readProvider 有一个公共 RPC 兜底；
 * 写操作必须有 signer，没有就返回 null（UI 据此禁用按钮）。
 */
import { useMemo } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import { SEPOLIA_RPC_URL } from "@wallet";
import { CONTRACT_ADDRESS, TICKET_ABI } from "../lib/contract";

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
