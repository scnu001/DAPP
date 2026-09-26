/**
 * useTicketArt —— 一张门票的封面从哪儿来。
 *
 * 优先级（这顺序本身就是「哪条路线更权威」的表达）：
 *   1. 本机缓存       —— 路线 0 选的图，或刚上传完的本地副本（state: "local"）
 *   2. 链上 metadata  —— 读 tokenURI → fetch 那份 JSON → 用它的 image（state: "chain"）
 *   3. 都没有         —— state: "empty"（baseURI 为空）/ "unreachable"（URL 取不到）
 *
 * 第 2 条是关键：它不看任何前端自己的状态，纯粹按 NFT 阅读器的方式走一遍
 * 「tokenURI → JSON → image」。所以只要能显出图，就说明 metadata 真的上链可读了。
 *
 * ⚠️ 只在**自己持有这张票**时才去拉（调用方传 tokenId）。12 张卡片各拉一次外部 JSON
 * 既慢又没必要 —— 我们现在链上那 12 场活动的 baseURI 还是占位符 example.com。
 */
import { useEffect, useState } from "react";
import { fetchTokenMetadata } from "../lib/tokenMetadata";

export function useTicketArt({ readContract, tokenId, localSrc }) {
  const [art, setArt] = useState(() =>
    localSrc ? { state: "local", image: localSrc } : { state: "idle" }
  );

  useEffect(() => {
    if (localSrc) {
      setArt({ state: "local", image: localSrc });
      return undefined;
    }
    if (!readContract || !tokenId) {
      setArt({ state: "idle" });
      return undefined;
    }

    let alive = true;
    setArt({ state: "loading" });

    (async () => {
      try {
        const uri = await readContract.tokenURI(tokenId);
        if (!alive) return;

        if (!uri) {
          // 合约里：baseURI 为空 → tokenURI() 直接返回 ""（见 TicketNFT.sol:142）
          setArt({ state: "empty" });
          return;
        }

        const doc = await fetchTokenMetadata(uri);
        if (!alive) return;

        if (doc?.image) setArt({ state: "chain", image: doc.image, doc, uri });
        else setArt({ state: "unreachable", uri });
      } catch (err) {
        if (alive) setArt({ state: "error", reason: err?.shortMessage ?? err?.message ?? String(err) });
      }
    })();

    return () => {
      alive = false;
    };
  }, [readContract, tokenId, localSrc]);

  return art;
}
