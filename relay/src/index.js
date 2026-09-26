/**
 * relay —— 门票 DApp 的最小上传 / 元数据服务（Cloudflare Worker，单文件）。
 *
 * 它只做两件事，都不涉及任何业务规则：
 *
 *   1. POST /upload  （multipart：eventId + timestamp + signature + image）
 *      验证「活动主办方钱包的签名」，通过后把封面图 + 一份 metadata JSON 提交到 GitHub 仓库
 *      （目录见 PAGES_DIR，默认 docs/，就是 GitHub Pages 的发布根），返回图片地址与 baseURI。
 *      —— relay 自己**不做权限判断**：它把签名恢复出的地址与链上 getEventInfo().organizer
 *         比对，权限依然由链上状态决定，relay 只是核对者。
 *
 *   2. GET  /meta/<tokenId>.json
 *      收到请求才去链上读 eventOfToken(tokenId) → getEventInfo(eventId)，
 *      现场拼出这一张票的 metadata JSON 返回。
 *      —— 这是**可选**的第二条路：因为 tokenId 只有 claim 之后才存在，静态文件没法提前生成。
 *         若把活动的 baseURI 填成 https://<relay>/meta/ ，所有活动共用同一个前缀，
 *         合约一行都不用改；代价是读路径从此依赖这个 Worker。
 *
 * 推荐做法（前端默认走这条）：
 *   用 /upload 返回的 baseURI（指向 GitHub Pages 上的静态 JSON + "#"），
 *   tokenURI = baseURI + tokenId + ".json" → ".../event-3.json#12.json"，
 *   "#" 之后的内容 HTTP 会忽略，照样取到 events/event-3.json → 读路径零依赖。
 *
 * ⛔ 它**不持有任何钱包私钥**，不能签交易、不能动资产、不能改合约状态。
 *    唯一的凭据是 `GITHUB_TOKEN`（只授权一个仓库的 contents:write），
 *    放在 Worker 的 secret 里，永远不进代码库、不到前端。
 *
 * 部署见同目录 README.md。
 */
import { Contract, JsonRpcProvider, verifyMessage } from "ethers";

const TICKET_ABI = [
  "function owner() view returns (address)",
  "function eventOfToken(uint256) view returns (uint256)",
  "function getEventInfo(uint256) view returns (tuple(string name,string baseURI,uint64 startAt,uint64 endAt,uint32 maxSupply,uint32 minted,bool open,address organizer))",
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** 只接受这几种位图。故意不放 svg —— SVG 里可以塞 <script>，而 GitHub Pages 是同源静态站。 */
const MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_BYTES = 2 * 1024 * 1024; // GitHub Contents API 单文件走 JSON base64，2 MB 足够且安全
const SIG_TTL_SECONDS = 300; // 签名带时间戳，超过 5 分钟视为重放

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...extra },
  });

const contract = (env) =>
  new Contract(env.CONTRACT_ADDRESS, TICKET_ABI, new JsonRpcProvider(env.RPC_URL));

/** Pages 站点根，例如 https://scnu001.github.io/DAPP （不带尾斜杠） */
const pagesBase = (env) => String(env.PAGES_BASE || "").replace(/\/+$/, "");

/** 仓库里作为 Pages 发布根的目录，默认 docs */
const pagesDir = (env) => String(env.PAGES_DIR || "docs").replace(/^\/+|\/+$/g, "");

/**
 * GitHub Contents API 的基地址。
 * 默认官方 api.github.com；可用 GITHUB_API 覆盖 —— GitHub Enterprise 要用它，
 * 而 relay/test-e2e-local.mjs 也是靠它把请求指到本地那个「假 GitHub」上，
 * 从而在**不需要 PAT、不需要真实仓库**的前提下把整条写路径跑通。
 */
const githubApi = (env) => String(env.GITHUB_API || "https://api.github.com").replace(/\/+$/, "");

/** 仓库内路径 → 例：docs/images/event-3.png */
const repoPath = (env, rel) => `${pagesDir(env)}/${rel}`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    try {
      if (request.method === "GET" && /^\/meta\/\d+\.json$/.test(url.pathname)) {
        return await metadata(url, env);
      }
      if (request.method === "POST" && url.pathname === "/upload") {
        return await upload(request, env);
      }
      if (url.pathname === "/health") {
        return json({
          ok: true,
          contract: env.CONTRACT_ADDRESS,
          pages: pagesBase(env),
          pagesDir: pagesDir(env),
          repo: env.GITHUB_REPO,
          githubApi: githubApi(env),
          githubTokenConfigured: Boolean(env.GITHUB_TOKEN),
        });
      }
      return json(
        {
          error: "not found",
          endpoints: ["GET /meta/<tokenId>.json", "POST /upload", "GET /health"],
        },
        404
      );
    } catch (err) {
      return json({ error: err?.shortMessage ?? err?.message ?? String(err) }, 500);
    }
  },
};

/* --------------------------- 1. 封面图 + metadata 上传 --------------------------- */

async function upload(request, env) {
  const form = await request.formData();
  const eventId = String(form.get("eventId") ?? "").trim();
  const timestamp = String(form.get("timestamp") ?? "").trim();
  const signature = String(form.get("signature") ?? "").trim();
  const file = form.get("image");

  if (!eventId || !timestamp || !signature || !file || typeof file === "string") {
    return json({ error: "缺少 eventId / timestamp / signature / image" }, 400);
  }
  // eventId 会参与拼路径，必须先卡成纯数字，否则可以拿 "../../" 去写仓库别的地方
  if (!/^\d+$/.test(eventId)) return json({ error: "eventId 必须是十进制整数" }, 400);

  // 防重放：签名里带时间戳，只接受 5 分钟内的
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SIG_TTL_SECONDS) {
    return json({ error: `签名已过期（超过 ${SIG_TTL_SECONDS / 60} 分钟）` }, 400);
  }

  const ext = MIME_EXT[String(file.type || "").toLowerCase()];
  if (!ext) return json({ error: "只接受 png / jpeg / webp / gif 图片" }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) return json({ error: "图片是空的" }, 400);
  if (bytes.length > MAX_BYTES) {
    return json({ error: `图片超过 ${MAX_BYTES / 1024 / 1024} MB` }, 413);
  }

  // 权限来自链上：签名恢复出的地址必须等于该活动的主办方
  const ticket = contract(env);
  let e;
  try {
    e = await ticket.getEventInfo(eventId);
  } catch {
    return json({ error: `活动 ${eventId} 不存在` }, 404);
  }
  const organizer = String(e.organizer ?? "");
  if (!organizer || organizer === ZERO_ADDRESS) {
    return json({ error: `活动 ${eventId} 不存在` }, 404);
  }

  let recovered;
  try {
    recovered = verifyMessage(`ticket-cover:${eventId}:${timestamp}`, signature);
  } catch {
    return json({ error: "签名格式不合法" }, 400);
  }
  if (recovered.toLowerCase() !== organizer.toLowerCase()) {
    return json({ error: "签名与活动主办方不符" }, 403);
  }

  const base = pagesBase(env);
  // 路径按 eventId 固定 → 前端与 metadata 都能直接拼 URL，不需要额外的映射表
  const imageRel = `images/event-${eventId}.${ext}`;
  const imageUrl = `${base}/${imageRel}`;
  const metaRel = `events/event-${eventId}.json`;
  const metaUrl = `${base}/${metaRel}`;

  // 这份 JSON 就是这一场活动的 metadata 底稿；tokenURI 会通过 "#" 指向它
  const doc = {
    name: `${e.name} 门票`,
    description: `${e.name} 的入场门票，由 TicketNFT 合约在 Sepolia 上签发。`,
    image: imageUrl,
    attributes: [
      { trait_type: "Event", value: String(e.name) },
      { trait_type: "Event ID", value: Number(eventId) },
      { trait_type: "Organizer", value: organizer },
    ],
  };

  const image = await putFile(env, repoPath(env, imageRel), bytes, `chore(metadata): 上传活动 #${eventId} 封面`);
  if (image.error) return json(image.error, image.status);

  const meta = await putFile(
    env,
    repoPath(env, metaRel),
    new TextEncoder().encode(`${JSON.stringify(doc, null, 2)}\n`),
    `chore(metadata): 更新活动 #${eventId} 的 metadata`
  );
  if (meta.error) return json(meta.error, meta.status);

  return json({
    ok: true,
    image: imageUrl,
    metadata: metaUrl,
    // 注意结尾的 "#"：tokenURI = baseURI + tokenId + ".json" → ".../event-3.json#12.json"
    // HTTP 请求会把 "#" 之后的部分丢掉，所以整场活动的票都读同一个静态 JSON。
    baseURI: `${metaUrl}#`,
    commits: { image: image.sha, metadata: meta.sha },
    note: "GitHub Pages 发布有 30-60 秒延迟；随后前端会把这个 baseURI 通过 updateEventURI 写到链上。",
  });
}

/**
 * 提交一个文件到 GitHub 仓库（不存在则新建，存在则覆盖 —— 覆盖必须先带上已有的 sha）。
 * 返回 { sha } 或 { error, status }；这里不抛异常，由调用方决定 HTTP 状态码。
 */
async function putFile(env, path, bytes, message) {
  if (!env.GITHUB_TOKEN) {
    return {
      error: { error: "Worker 未配置 GITHUB_TOKEN", hint: "npx wrangler secret put GITHUB_TOKEN" },
      status: 500,
    };
  }

  const api = `${githubApi(env)}/repos/${env.GITHUB_REPO}/contents/${path}`;
  const headers = {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "ticket-dapp-relay",
  };

  const head = await fetch(api, { headers });
  let sha;
  if (head.ok) sha = (await head.json()).sha;
  else if (head.status !== 404) {
    return { error: { error: `读取 ${path} 失败：${head.status}` }, status: 502 };
  }

  const put = await fetch(api, {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ message, content: toBase64(bytes), sha }),
  });
  if (!put.ok) {
    const detail = await put.text();
    return {
      error: { error: `GitHub 提交 ${path} 失败：${put.status}`, detail: detail.slice(0, 300) },
      status: 502,
    };
  }
  const result = await put.json();
  return { sha: result?.commit?.sha ?? null };
}

/* ---------------------------- 2. 动态 metadata（可选） ---------------------------- */

async function metadata(url, env) {
  const tokenId = url.pathname.match(/^\/meta\/(\d+)\.json$/)[1];
  const ticket = contract(env);

  let eventId;
  try {
    // 合约用 _requireOwned 拦不存在的 token，所以这里能直接当「票是否存在」的判据
    eventId = await ticket.eventOfToken(tokenId);
  } catch {
    return json({ error: `token ${tokenId} 不存在` }, 404);
  }

  const e = await ticket.getEventInfo(eventId);
  const idNum = Number(eventId);
  const eventName = String(e.name || "");

  // 如果这个活动已经在链上登记了「静态 metadata JSON」（/upload 写入的那份），
  // 就拿它当底稿，只补上与这一张票有关的信息 ——
  // 这样图片的扩展名、属性定义都只有一处真源，不会两边各写一遍。
  let doc = null;
  const registered = String(e.baseURI || "").split("#")[0];
  // 自引用保护：baseURI 指向本站 /meta/ 时再去 fetch 会无限递归
  if (registered && !registered.startsWith("ipfs://") && !registered.startsWith(`${url.origin}/meta/`)) {
    try {
      const res = await fetch(registered, { headers: { accept: "application/json" } });
      if (res.ok) doc = await res.json();
    } catch {
      /* 拿不到底稿就算了，下面有兜底 */
    }
  }

  const attributes = Array.isArray(doc?.attributes) ? [...doc.attributes] : [];
  attributes.push({ trait_type: "Token ID", value: Number(tokenId) });

  return json(
    {
      name: doc?.name ? `${doc.name} #${tokenId}` : `${eventName || "Ticket"} Ticket #${tokenId}`,
      description:
        doc?.description ?? `${eventName} 的入场门票，由 TicketNFT 合约在 Sepolia 上签发。`,
      image: doc?.image ?? `${pagesBase(env)}/images/event-${idNum}.png`,
      attributes,
    },
    200,
    { "cache-control": "public, max-age=60" } // 短缓存：换封面后一分钟内自愈
  );
}

/** btoa 的二进制安全版本（分块，避免大图撑爆调用栈） */
function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}
