import { useState } from "react";
import { datetimeLocalToSeconds } from "../lib/format";
import CoverUpload from "./CoverUpload";

export default function OrganizerPanel({
  isOrganizer,
  canWrite,
  busy,
  coverTx,
  coverMode,
  coverReady,
  covers,
  onUpload,
  onClearLocal,
  onCreate,
}) {
  const [form, setForm] = useState({
    name: "",
    baseURI: "",
    maxSupply: "100",
    startAt: "",
    endAt: "",
  });
  const [newId, setNewId] = useState(null);

  if (!isOrganizer) return null;

  const submit = async (e) => {
    e.preventDefault();
    setNewId(null);
    const id = await onCreate({
      name: form.name,
      baseURI: form.baseURI,
      maxSupply: Number(form.maxSupply),
      startAt: datetimeLocalToSeconds(form.startAt),
      endAt: datetimeLocalToSeconds(form.endAt),
    });
    if (id !== null && id !== undefined) {
      setNewId(id.toString());
      setForm({ name: "", baseURI: "", maxSupply: "100", startAt: "", endAt: "" });
    }
  };

  return (
    <section className="panel">
      <h2>主办方控制台</h2>
      <form className="form" onSubmit={submit}>
        <label>
          活动名称
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Web3 Concert 2026"
            required
          />
        </label>

        <div className="row">
          <label>
            门票上限
            <input
              type="number"
              min="1"
              value={form.maxSupply}
              onChange={(e) => setForm({ ...form, maxSupply: e.target.value })}
              required
            />
          </label>
          <label>
            开始时间（可选）
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            />
          </label>
          <label>
            结束时间（可选）
            <input
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm({ ...form, endAt: e.target.value })}
            />
          </label>
        </div>

        <details className="advanced">
          <summary>高级：手填 metadata 基地址</summary>
          <label>
            元数据基地址（baseURI）
            <input
              value={form.baseURI}
              onChange={(e) => setForm({ ...form, baseURI: e.target.value })}
              placeholder="ipfs://CID/ 或 https://…/meta/"
            />
            <span className="hint">
              最终 tokenURI = baseURI + tokenId + ".json"。留空即可 —— 建完活动后在下面上传封面，
              系统会自动把 baseURI 指向 GitHub Pages 上那份 metadata。
            </span>
          </label>
        </details>

        <button className="btn btn-primary" type="submit" disabled={!canWrite || busy}>
          {busy ? "处理中…" : "创建活动（上链）"}
        </button>

        {newId ? (
          <div className="created">
            <p className="success">
              创建成功：eventId = <b>#{newId}</b>（由 EventCreated 事件解析得到）
            </p>
            <CoverUpload
              eventId={newId}
              canWrite={canWrite}
              disabled={busy}
              coverTx={coverTx}
              mode={coverMode}
              ready={coverReady}
              onUpload={onUpload}
              onClear={onClearLocal}
              localCover={covers?.[String(newId)] || ""}
            />
          </div>
        ) : null}
      </form>
    </section>
  );
}
