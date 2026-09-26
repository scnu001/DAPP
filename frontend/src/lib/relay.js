/**
 * relay.js —— 封面图上传客户端（业务层，不是钱包层）。
 *
 * 它只做一件事：把「图片 + 主办方签名」POST 给 relay Worker，
 * 拿回 { image, metadata, baseURI }，交给上层去发 updateEventURI。
 *
 * 为什么前端不能直接提交到 GitHub：
 *   往仓库写文件需要 PAT，而前端代码是**公开下载**的（Vite 里 VITE_ 前缀的变量还会
 *   被主动打进 bundle），任何写在前端的东西都等于公开。所以这里只出示**签名**——
 *   它证明「你是这场活动的主办方」，而 PAT 留在 Worker 的 secret 里。
 *   两边各拿一半，谁都单独用不了。
 *
 * 与钱包层的边界：这个文件里没有 window.ethereum，也没有私钥。
 *   签名由上层从 wallet.signer 拿到后传进来。
 */

/** relay Worker 的地址，来自 frontend/.env 的 VITE_RELAY_URL */
export const RELAY_URL = (import.meta.env.VITE_RELAY_URL || "").trim().replace(/\/+$/, "");

/** 签名原文。必须和 relay/src/index.js 里 verifyMessage 用的字符串逐字一致。 */
export function coverSignMessage(eventId, timestamp) {
  return `ticket-cover:${eventId}:${timestamp}`;
}

/** 前端先做一遍和 Worker 完全相同的校验，免得白签一次名 */
export const COVER_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const COVER_MAX_BYTES = 2 * 1024 * 1024;

/**
 * 上传封面。
 * @param {{eventId:number|string, timestamp:number, signature:string, file:File}} p
 * @returns {Promise<{ok:boolean, image:string, metadata:string, baseURI:string, note?:string}>}
 */
export async function uploadCover({ eventId, timestamp, signature, file }) {
  if (!RELAY_URL) {
    throw new Error(
      "未配置 relay 地址：把 Worker 地址写进 frontend/.env 的 VITE_RELAY_URL，再重启 npm run dev"
    );
  }

  const form = new FormData();
  form.append("eventId", String(eventId));
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("image", file, file.name);

  let res;
  try {
    res = await fetch(`${RELAY_URL}/upload`, { method: "POST", body: form });
  } catch (err) {
    throw new Error(`连不上 relay（${RELAY_URL}）：${err?.message ?? err}`);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new Error(body.error ? `${body.error}${body.hint ? `（${body.hint}）` : ""}` : `relay 返回 ${res.status}`);
  }
  return body;
}

/** 探测 relay 是否活着（用于在 UI 上提前给出提示，而不是等用户点了上传才报错） */
export async function pingRelay() {
  if (!RELAY_URL) return { ok: false, reason: "未配置 VITE_RELAY_URL" };
  try {
    const res = await fetch(`${RELAY_URL}/health`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) return { ok: false, reason: `HTTP ${res.status}` };
    return { ok: true, pages: body.pages, tokenConfigured: Boolean(body.githubTokenConfigured) };
  } catch (err) {
    return { ok: false, reason: err?.message ?? String(err) };
  }
}
