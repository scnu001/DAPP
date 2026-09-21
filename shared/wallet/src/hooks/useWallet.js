/**
 * useWallet —— 钱包层的唯一实现（single source of truth）。
 *
 * ⚠️ 这是 `shared/wallet` 的内部实现，**不要**跨项目直接 import 这个文件路径。
 *    外部一律走公开入口 `@wallet`（= shared/wallet/src/index.js），
 *    这样以后内部怎么改，消费方都不用动。
 *
 * 所有 window.ethereum 调用只出现在这个文件里。
 * 里面没有任何一行业务代码 —— 搜索 claim / createEvent / TicketNFT / ABI 都找不到。
 *
 * 状态机：
 *   loading → noMetaMask / disconnected ⇄ connecting → connected ⇄ wrongNetwork
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserProvider } from "ethers";
import { SEPOLIA_CHAIN_ID, SEPOLIA_NETWORK_PARAMS } from "../lib/chain";
import { isSepolia } from "../lib/errors";

const hasInjected = () => typeof window !== "undefined" && Boolean(window.ethereum);

export function useWallet() {
  const [status, setStatus] = useState("loading");
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [error, setError] = useState("");

  // 事件回调里要读「当前账号」，用 ref 避免闭包过期
  const accountRef = useRef("");

  const applyAccount = useCallback((addr) => {
    accountRef.current = addr || "";
    setAccount(addr || "");
  }, []);

  const buildProvider = useCallback(() => {
    if (!hasInjected()) return null;
    return new BrowserProvider(window.ethereum);
  }, []);

  const attachSigner = useCallback(async (p) => {
    if (!p) {
      setSigner(null);
      return;
    }
    try {
      setSigner(await p.getSigner());
    } catch {
      setSigner(null);
    }
  }, []);

  /** 读一次 eth_chainId 并写进 state，返回是否在 Sepolia */
  const syncChain = useCallback(async () => {
    if (!hasInjected()) return false;
    const hex = await window.ethereum.request({ method: "eth_chainId" }); // 不弹窗
    setChainId(hex);
    return isSepolia(hex);
  }, []);

  /** 自动切换 / 添加 Sepolia。返回切换后是否已经在 Sepolia */
  const ensureSepolia = useCallback(async () => {
    if (!hasInjected()) throw new Error("请先安装 MetaMask");
    if (await syncChain()) return true;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (err) {
      if (err?.code === 4902) {
        // 钱包里没有 Sepolia：先添加再切
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [SEPOLIA_NETWORK_PARAMS],
        });
      } else if (err?.code === 4001) {
        throw new Error("你在钱包里拒绝了切换网络");
      } else {
        throw new Error(
          `切换网络失败（code ${err?.code ?? "?"}），请在 MetaMask 里手动切到 Sepolia`
        );
      }
    }

    // switch/addEthereumChain 的 Promise 语义不可靠（部分版本提前 resolve / 抛 -32603）
    // —— 轮询复核，最多等 3 秒
    for (let i = 0; i < 10; i += 1) {
      if (await syncChain()) return true;
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error("未能切到 Sepolia，请手动切换后重试");
  }, [syncChain]);

  /** 点击「连接钱包」：eth_requestAccounts（会弹授权窗） */
  const connect = useCallback(async () => {
    if (!hasInjected()) {
      setStatus("noMetaMask");
      return;
    }
    setError("");
    setStatus("connecting");
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0] ?? "";
      if (!addr) {
        setStatus("disconnected");
        return;
      }
      applyAccount(addr);
      const ok = await ensureSepolia();
      const p = buildProvider();
      setProvider(p);
      await attachSigner(p);
      setStatus(ok ? "connected" : "wrongNetwork");
    } catch (err) {
      applyAccount("");
      setStatus("disconnected");
      setError(err?.message ?? String(err));
    }
  }, [applyAccount, attachSigner, buildProvider, ensureSepolia]);

  /**
   * mount-only effect：
   *   1) eth_accounts 静默恢复（已授权站点不弹窗）
   *   2) 注册 accountsChanged / chainChanged
   * 依赖数组必须是 []，否则每次渲染都会重复解绑/绑定（教程示例就漏了这点）
   */
  useEffect(() => {
    if (!hasInjected()) {
      setStatus("noMetaMask");
      return undefined;
    }
    const eth = window.ethereum;
    let alive = true;

    (async () => {
      try {
        const accounts = await eth.request({ method: "eth_accounts" }); // 静默，不弹窗
        if (!alive) return;
        if (accounts && accounts[0]) {
          applyAccount(accounts[0]);
          const ok = await syncChain();
          const p = buildProvider();
          setProvider(p);
          await attachSigner(p);
          setStatus(ok ? "connected" : "wrongNetwork");
        } else {
          setStatus("disconnected");
        }
      } catch {
        if (alive) setStatus("disconnected");
      }
    })();

    const onAccountsChanged = async (accounts) => {
      const next = accounts?.[0] ?? "";
      applyAccount(next);
      setSigner(null); // 换账号 = 换人，旧 signer 作废
      if (!next) {
        // 空数组 = 钱包锁定 / 撤销授权
        setStatus("disconnected");
        return;
      }
      const ok = await syncChain();
      const p = buildProvider();
      setProvider(p);
      await attachSigner(p);
      setStatus(ok ? "connected" : "wrongNetwork");
    };

    const onChainChanged = async (hex) => {
      setChainId(hex);
      // 网络变了，BrowserProvider 内部缓存的网络可能失效 → 重建
      const p = buildProvider();
      setProvider(p);
      if (accountRef.current) await attachSigner(p);

      const ok = isSepolia(hex);
      setStatus((prev) => {
        if (prev === "disconnected" || prev === "noMetaMask" || prev === "connecting") return prev;
        return ok ? "connected" : "wrongNetwork";
      });
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);

    return () => {
      alive = false;
      eth.removeListener("accountsChanged", onAccountsChanged);
      eth.removeListener("chainChanged", onChainChanged);
    };
  }, [applyAccount, attachSigner, buildProvider, syncChain]);

  /** MetaMask 没有真正的「断开」接口；wallet_revokePermissions 可以撤掉本站授权 */
  const disconnect = useCallback(async () => {
    try {
      if (hasInjected()) {
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      }
    } catch {
      /* 部分钱包不支持，忽略 */
    }
    applyAccount("");
    setSigner(null);
    setStatus("disconnected");
  }, [applyAccount]);

  return {
    status, // loading | noMetaMask | disconnected | connecting | connected | wrongNetwork
    account,
    chainId,
    provider,
    signer,
    error,
    connect,
    disconnect,
    ensureSepolia,
    isConnected: status === "connected",
    isWrongNetwork: status === "wrongNetwork",
  };
}
