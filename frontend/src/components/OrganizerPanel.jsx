import { useState } from "react";
import { datetimeLocalToSeconds } from "../lib/format";

export default function OrganizerPanel({ isOrganizer, canWrite, busy, onCreate }) {
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

        <label>
          元数据基地址（baseURI）
          <input
            value={form.baseURI}
            onChange={(e) => setForm({ ...form, baseURI: e.target.value })}
            placeholder="https://example.com/meta/ 或 ipfs://CID/"
          />
          <span className="hint">最终 tokenURI = baseURI + tokenId + ".json"，留空则不显示图片</span>
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

        <button className="btn btn-primary" type="submit" disabled={!canWrite || busy}>
          {busy ? "处理中…" : "创建活动（上链）"}
        </button>

        {newId ? (
          <p className="success">
            创建成功：eventId = <b>#{newId}</b>（由 EventCreated 事件解析得到）
          </p>
        ) : null}
      </form>
    </section>
  );
}
