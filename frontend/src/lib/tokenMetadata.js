/**
 * tokenMetadata.js —— 像 NFT 阅读器那样按 tokenURI 去取元数据。
 *
 * 合约里 `tokenURI = baseURI + tokenId + ".json"`（`contracts/TicketNFT.sol:139`）。
 * 我们的 baseURI 以 "#" 结尾，于是：
 *
 *   tokenURI(12) = https://scnu001.github.io/DAPP/events/event-3.json#12.json
 *                                                                  └── 浏览器发请求前丢掉
 *   ⇒ GET https://scnu001.github.io/DAPP/events/event-3.json
 *
 * 所以这里不需要任何特殊处理 —— 直接把 tokenURI 交给 fetch 就行。
 * 这也顺带成了一条**端到端验证**：能显示出图片，就说明「链上 baseURI → 静态 JSON → 图片」
 * 整条链路真的通了，而不是我们自己在页面里拼出来的假象。
 */

/** ipfs:// → 公共网关。非 ipfs 的 URL 原样返回 */
export function toFetchable(uri) {
  const s = String(uri || "").trim();
  if (!s) return "";
  if (s.startsWith("ipfs://")) {
    // ipfs://<cid>/<path>  →  https://ipfs.io/ipfs/<cid>/<path>
    return `https://ipfs.io/ipfs/${s.slice("ipfs://".length).replace(/^ipfs\//, "")}`;
  }
  return s;
}

/** 同一个 tokenURI 在一个会话里只取一次（baseURI 不变就不必重复请求） */
const cache = new Map();

export function fetchTokenMetadata(tokenUri) {
  const url = toFetchable(tokenUri);
  if (!url) return Promise.resolve(null);
  if (cache.has(url)) return cache.get(url);

  const p = (async () => {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) return null;
      const doc = await res.json();
      return doc && typeof doc === "object" ? doc : null;
    } catch {
      // 网络失败 / CORS / 不是 JSON —— 都当作「取不到」，由调用方降级
      return null;
    }
  })();

  cache.set(url, p);
  return p;
}

export function clearTokenMetadataCache() {
  cache.clear();
}
