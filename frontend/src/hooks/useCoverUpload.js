/**
 * useCoverUpload —— 「选好图片 → 得到封面」这一条流水线，两种模式共用同一个状态机。
 *
 * ── relay 模式（默认，路线 2）四次动作，缺一不可 ──────────────────────────────
 *   1. ensureSepolia()                      —— 保证在 Sepolia（幂等，已在本网立刻返回）
 *   2. signer.signMessage(...)              —— 弹一次钱包确认；签名不花 gas、不上链
 *   3. POST /upload（relay Worker）          —— relay 验签 + 把图片与 metadata 提交进仓库
 *   4. writeContract.updateEventURI(...)    —— 真正的链上写操作，这里才付 gas
 *
 *   注意第 2 步与第 4 步是**两次独立的钱包动作**：
 *     签名只是「证明我是这场活动的主办方」，权限判定在链上（relay 把恢复出的地址与 organizer 比对）；
 *     updateEventURI 才是改状态的那一笔交易。所以用户要确认两次，这是对的，不是多余的。
 *
 * ── local 模式（路线 0，兜底，默认关闭）──────────────────────────────────────
 *   压缩 → 写 localStorage。**不签名、不上传、不上链**，`baseURI` 保持为空
 *   ⇒ 合约 `tokenURI()` 返回空字符串 ⇒ 外部查看器看不到这张图。
 *
 * 两种模式都会把结果缓存在本机（local 存 data URL、relay 存拿回的 Pages URL），
 * 于是「我的门票」卡片能立刻显示封面，不必等 GitHub Pages 那 30-60 秒。
 */
import { useCallback, useState } from "react";
import { isUserRejection } from "@wallet";
import { RELAY_URL, coverSignMessage, uploadCover } from "../lib/relay";
import { dataUrlBytes, shrinkImage } from "../lib/localCover";

export function useCoverUpload({ wallet, onUpdateBaseURI, localMode, saveLocal, removeLocal }) {
  const [coverTx, setCoverTx] = useState({ state: "idle" });

  const resetCover = useCallback(() => setCoverTx({ state: "idle" }), []);

  /** 删掉本机缓存（不改链上任何东西） */
  const clearLocal = useCallback(
    (eventId) => {
      removeLocal?.(eventId);
      setCoverTx({ state: "idle" });
    },
    [removeLocal]
  );

  const run = useCallback(
    async (eventId, file) => {
      /* ------------------------------ 路线 0：只存本机 ------------------------------ */
      if (localMode) {
        try {
          setCoverTx({ state: "signing", reason: "正在压缩到本机可存的大小…" });
          const dataUrl = await shrinkImage(file);
          saveLocal(eventId, dataUrl); // 可能抛「本机存储已满」
          setCoverTx({
            state: "done",
            mode: "local",
            image: dataUrl,
            bytes: dataUrlBytes(dataUrl),
            note:
              "已保存在本机浏览器 —— 没有上传、没有上链，链上 baseURI 仍为空，" +
              "外部查看器（MetaMask / OpenSea）看不到这张图。",
          });
          return { ok: true, mode: "local" };
        } catch (err) {
          setCoverTx({ state: "error", reason: err?.message ?? String(err) });
          return null;
        }
      }

      /* ---------------------------- 路线 2：relay + 链上 ---------------------------- */
      if (!wallet?.signer) {
        setCoverTx({ state: "error", reason: "请先连接钱包并切换到 Sepolia" });
        return null;
      }

      try {
        await wallet.ensureSepolia(); // 幂等

        setCoverTx({ state: "signing", reason: "等待钱包签名（这一步不上链、不花 gas）" });
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await wallet.signer.signMessage(coverSignMessage(eventId, timestamp));

        setCoverTx({ state: "uploading", reason: "正在提交到 GitHub…" });
        const res = await uploadCover({ eventId, timestamp, signature, file });

        setCoverTx({ state: "updating", reason: "正在把 baseURI 写到链上（这一步要花 gas）…" });
        await onUpdateBaseURI(eventId, res.baseURI);

        // 顺手缓存 Pages 上的图片地址，卡片不用等那 30-60 秒发布延迟
        saveLocal?.(eventId, res.image);

        setCoverTx({
          state: "done",
          mode: "relay",
          image: res.image,
          metadata: res.metadata,
          baseURI: res.baseURI,
          note: res.note,
        });
        return res;
      } catch (err) {
        // 用户在钱包里点了「拒绝」不是错误，单独给一句话
        const reason = isUserRejection(err)
          ? "你在钱包里取消了签名/交易"
          : err?.shortMessage ?? err?.message ?? String(err);
        setCoverTx({ state: "error", reason });
        return null;
      }
    },
    [wallet, onUpdateBaseURI, localMode, saveLocal]
  );

  return {
    coverTx,
    resetCover,
    clearLocal,
    uploadCoverFile: run,
    mode: localMode ? "local" : "relay",
    // 兜底模式不需要 relay，所以不算「没配好」
    ready: localMode || Boolean(RELAY_URL),
  };
}
