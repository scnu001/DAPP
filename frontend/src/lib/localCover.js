/**
 * localCover.js —— 路线 0「兜底模式」：封面只存在本机浏览器里。
 *
 * 打开方式（默认关闭）：
 *   frontend/.env 里写  VITE_LOCAL_COVER=on
 *
 * 这条路线**不签名、不上传、不上链**：
 *   - 图片经 canvas 缩放重编码后写进 localStorage
 *   - 活动的 `baseURI` 保持为空 ⇒ 合约 `tokenURI()` 返回空字符串
 *   - 结果是「dApp 里能看到封面，但外部查看器（MetaMask / OpenSea）看不到图」
 *
 * 用途很明确：relay 还没部署、或者部署坏了的时候，这个功能仍然能在**报告和 Demo 视频里
 * 演示完整交互**。但它绝不能冒充「metadata 已经上链」—— 所以 UI 上会明确标注
 * 「封面来自本机（未上链）」，而且这个开关默认是关的。
 *
 * 同理，relay 模式上传成功后也会把拿回的图片 URL 缓存进同一个存储，
 * 好让「我的门票」卡片立刻能显示封面（不必等 GitHub Pages 那 30-60 秒）。
 */
import { CONTRACT_ADDRESS } from "./contract";

const FLAG = String(import.meta.env.VITE_LOCAL_COVER || "off").trim().toLowerCase();
export const LOCAL_COVER_ENABLED = ["on", "true", "1", "yes"].includes(FLAG);

const PREFIX = "tkt:cover";
const KEY = (eventId) => `${PREFIX}:${CONTRACT_ADDRESS.toLowerCase()}:${eventId}`;

/** 压缩上限。localStorage 通常只有 ~5 MB，一张手机原图就能撑爆 */
export const MAX_W = 960;
export const MAX_H = 600;
const QUALITY = 0.82;

/** data URL 的实际字节数（base64 每 4 个字符代表 3 字节） */
export function dataUrlBytes(dataUrl) {
  const i = String(dataUrl).indexOf(",");
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/**
 * 把用户选的图缩到 ≤ MAX_W × MAX_H 并重新编码。
 * 优先 WebP（支持透明通道且体积最小）；浏览器不支持时退回 JPEG。
 * @returns {Promise<string>} data URL
 */
export function shrinkImage(file, { maxW = MAX_W, maxH = MAX_H, quality = QUALITY } = {}) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("这个文件不是浏览器能解码的图片"));
    };

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("拿不到 canvas 2d 上下文");
        ctx.drawImage(img, 0, 0, w, h);

        // 先试 WebP；浏览器若不支持会静默回退成 PNG，那就改用 JPEG 再压一次
        let out = canvas.toDataURL("image/webp", quality);
        if (!out.startsWith("data:image/webp")) {
          out = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(out);
      } catch (err) {
        reject(err);
      }
    };

    img.src = objectUrl;
  });
}

/** 读出当前合约下所有已缓存的封面：{ [eventId]: src } */
export function loadLocalCovers() {
  const out = {};
  try {
    const head = `${PREFIX}:${CONTRACT_ADDRESS.toLowerCase()}:`;
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(head)) continue;
      const id = k.slice(head.length);
      const v = localStorage.getItem(k);
      if (v) out[id] = v;
    }
  } catch {
    /* 隐私模式 / 存储被禁 —— 当作没有封面即可，不要炸掉整个页面 */
  }
  return out;
}

/** src 可以是 data URL（本机图）或 http(s) URL（relay 上传后的 Pages 地址） */
export function saveLocalCover(eventId, src) {
  try {
    localStorage.setItem(KEY(eventId), src);
  } catch (err) {
    const quota =
      err?.name === "QuotaExceededError" ||
      err?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err?.code === 22;
    throw new Error(
      quota
        ? `本机存储已满（封面已压缩，但 localStorage 只有几 MB）。先删掉几张不用的封面再试。`
        : `写入本机存储失败：${err?.message ?? err}`
    );
  }
}

export function removeLocalCover(eventId) {
  try {
    localStorage.removeItem(KEY(eventId));
  } catch {
    /* 忽略 */
  }
}

/** 演示/报告里常用：清掉本合约下的全部本机封面 */
export function clearLocalCovers() {
  try {
    const head = `${PREFIX}:${CONTRACT_ADDRESS.toLowerCase()}:`;
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(head)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* 忽略 */
  }
}
