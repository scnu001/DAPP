/**
 * NetworkBadge —— 当前网络徽章 + 「切换到 Sepolia」按钮。
 * 与原项目逐字一致，唯一改动：SEPOLIA_CHAIN_ID 的 import 从 ../lib/contract 改成 ../lib/chain
 * （本模块不加载任何合约 ABI）。
 *
 * 只在 status === "connected" 时显示绿点；wrongNetwork 时变黄并给出「切换到 Sepolia」。
 */
import { SEPOLIA_CHAIN_ID } from "../lib/chain";

const CHAIN_NAMES = {
  "0x1": "Ethereum 主网",
  "0xaa36a7": "Sepolia 测试网",
  "0x7a69": "Hardhat 本地链 (31337)",
  "0x5": "Goerli（已弃用）",
  "0x89": "Polygon",
};

export default function NetworkBadge({ wallet }) {
  const { status, chainId, ensureSepolia, error } = wallet;
  if (!chainId) return null;

  const ok = status === "connected";
  const name = CHAIN_NAMES[String(chainId).toLowerCase()] ?? `未知网络 (${chainId})`;

  return (
    <div className={`network-badge ${ok ? "ok" : "bad"}`}>
      <span className="dot" />
      <span>{name}</span>
      {!ok && status !== "noMetaMask" && status !== "disconnected" ? (
        <button
          className="btn btn-warn"
          onClick={async () => {
            try {
              await ensureSepolia();
            } catch (e) {
              // 错误已经在 wallet.error / 页面上展示
              console.warn(e);
            }
          }}
        >
          切换到 Sepolia ({SEPOLIA_CHAIN_ID})
        </button>
      ) : null}
      {error ? <span className="inline-error">{error}</span> : null}
    </div>
  );
}
