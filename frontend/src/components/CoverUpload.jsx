import { useCallback, useEffect, useRef, useState } from "react";
import { COVER_MAX_BYTES, COVER_MIME } from "../lib/relay";

const accept = COVER_MIME.join(",");
const humanMB = Math.round(COVER_MAX_BYTES / 1024 / 1024);

/**
 * 活动封面控件。两种模式共用一套 UI，只有「按下按钮之后会发生什么」不同：
 *
 *   relay（默认）  压缩 → 钱包签名 → 提交 GitHub → 发一笔 updateEventURI（花 gas）
 *   local（兜底）  压缩 → 写 localStorage（不签名、不上传、不上链）
 *
 * 所以按钮文案与结果提示都随模式变，而且兜底模式会**显式标注「未上链」** ——
 * 免得日后看截图的人误以为 metadata 已经托管好了。
 */
export default function CoverUpload({
  eventId,
  canWrite,
  disabled,
  coverTx,
  mode = "relay",
  ready = true,
  onUpload,
  onClear,
  localCover = "",
  currentBaseURI,
}) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [localError, setLocalError] = useState("");

  const isLocal = mode === "local";

  // ⚠️ file 与 preview 必须在**同一个 handler 里一起改**。
  // 之前 preview 是由 useEffect(file) 派生的，于是 setFile(null) 之后、effect 跑之前的
  // 那一帧会渲染出 { file: null, preview: "blob:..." }，下面 {file.name} 直接抛
  // 「Cannot read properties of null (reading 'name')」，没有错误边界 ⇒ 整个应用卸载白屏。
  // 现在两者同生同灭，这个中间态在结构上就不可能出现。
  const clearFile = useCallback(() => {
    setFile(null);
    setPreview("");
  }, []);

  /** @param {File|null} f 传 null 表示「当前没有选中文件」 */
  const choose = useCallback((f) => {
    if (!f) {
      setFile(null);
      setPreview("");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  // objectURL 必须回收：换图时回收上一份，卸载时回收最后一份
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const pick = (e) => {
    setLocalError("");
    const f = e.target.files?.[0];
    if (!f) {
      choose(null);
      return;
    }
    if (!COVER_MIME.includes(f.type)) {
      setLocalError("只支持 PNG / JPEG / WebP / GIF");
      choose(null);
      return;
    }
    // 本机模式反正要压缩，放宽到 8 MB 也能接受；relay 模式必须先卡住，因为 Worker 上限是 2 MB
    const limit = isLocal ? 8 * 1024 * 1024 : COVER_MAX_BYTES;
    if (f.size > limit) {
      setLocalError(
        `图片 ${(f.size / 1024 / 1024).toFixed(1)} MB，超过上限 ${Math.round(limit / 1024 / 1024)} MB`
      );
      choose(null);
      return;
    }
    choose(f);
  };

  const busy = ["signing", "uploading", "updating"].includes(coverTx?.state);
  // 兜底模式不需要钱包，所以不看 canWrite
  const blocked = (!isLocal && !canWrite) || disabled || busy || !ready;

  const submit = async () => {
    if (!file) return;
    const ok = await onUpload(eventId, file);
    // 只有成功才清空输入框；失败时保留选中的图，用户改一下就能重试
    if (ok) {
      clearFile();
      if (inputRef.current) inputRef.current.value = ""; // 允许再选同一张图
    }
  };

  const done = coverTx?.state === "done";
  const shown = localCover || (done ? coverTx.image : "");

  return (
    <div className="cover">
      {isLocal ? (
        <p className="cover-note cover-note-warn">
          <b>兜底模式</b>（<code>VITE_LOCAL_COVER=on</code>）：封面只存在本机浏览器，
          <b>不上传、不上链</b>，链上 <code>baseURI</code> 保持为空 ⇒ 外部查看器看不到这张图。
          正式提交前请把 <code>VITE_LOCAL_COVER</code> 改回 <code>off</code>。
        </p>
      ) : null}

      <label className="cover-pick">
        <span className="cover-label">活动封面{isLocal ? "（本机）" : ""}</span>
        <input ref={inputRef} type="file" accept={accept} onChange={pick} disabled={busy} />
      </label>
      <span className="hint">
        {isLocal
          ? "PNG/JPEG/WebP/GIF，≤ 8 MB。会自动缩到 960×600 并重编码后再存，避免撑爆 localStorage。"
          : `PNG/JPEG/WebP/GIF，≤ ${humanMB} MB。图片会提交到仓库，metadata 由 GitHub Pages 托管，随后自动把 baseURI 写到链上。`}
      </span>

      {localError ? <p className="inline-error">{localError}</p> : null}

      {!ready ? (
        <p className="cover-note cover-note-warn">
          relay 未就绪：把 Worker 地址写进 <code>frontend/.env</code> 的 <code>VITE_RELAY_URL</code>，
          再重启 dev server；或者把 <code>VITE_LOCAL_COVER</code> 设为 <code>on</code> 走本机兜底模式。
        </p>
      ) : null}

      {preview && file ? (
        <div className="cover-preview">
          <img src={preview} alt="待保存的封面预览" />
          <div className="cover-preview-meta">
            <p className="muted small">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
            <button
              className="btn btn-primary btn-xs"
              type="button"
              disabled={blocked}
              onClick={submit}
            >
              {busy ? "处理中…" : isLocal ? "保存到本机（不上链）" : "上传并更新链上 baseURI"}
            </button>
          </div>
        </div>
      ) : null}

      {coverTx?.state && coverTx.state !== "idle" && !done ? (
        <p className={coverTx.state === "error" ? "inline-error" : "cover-note"}>{coverTx.reason}</p>
      ) : null}

      {done ? (
        <p className={coverTx.mode === "local" ? "cover-note cover-note-warn" : "cover-note cover-note-ok"}>
          已保存：{coverTx.image?.startsWith("data:") ? "本机浏览器" : ""}
          {coverTx.metadata ? (
            <>
              <a href={coverTx.metadata} target="_blank" rel="noreferrer">
                metadata JSON
              </a>
              {" · "}
              <a href={coverTx.image} target="_blank" rel="noreferrer">
                封面图
              </a>
            </>
          ) : null}
          <br />
          {coverTx.baseURI ? (
            <>
              baseURI = <code>{coverTx.baseURI}</code>
              <br />
            </>
          ) : null}
          {coverTx.note}
        </p>
      ) : null}

      {shown && !preview ? (
        <div className="cover-preview">
          <img src={shown} alt="当前封面" />
          <div className="cover-preview-meta">
            <p className="muted small">
              当前封面：{String(shown).startsWith("data:") ? "本机（未上链）" : "GitHub Pages"}
            </p>
            {onClear ? (
              <button className="btn btn-ghost btn-xs" type="button" onClick={() => onClear(eventId)}>
                清除本机缓存
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!isLocal && currentBaseURI !== undefined ? (
        <p className="muted small">
          当前链上 baseURI：<code>{currentBaseURI || "（空 → tokenURI 返回空字符串）"}</code>
        </p>
      ) : null}
    </div>
  );
}
