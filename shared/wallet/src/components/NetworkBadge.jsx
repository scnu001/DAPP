/**
 * NetworkBadge —— 网络徽章 + 「切换到 Sepolia」按钮，纯展示组件。
 *
 * 只从 props 拿到 wallet 对象；链常量来自 lib/chain.js（不认识任何合约）。
 * 锚点：.network-badge / .network-badge.ok / .network-badge.bad / .inline-error
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
              // 错误已经在 wallet.error / TxStatus 里展示
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
