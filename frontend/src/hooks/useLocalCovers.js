/**
 * useLocalCovers —— 把 lib/localCover.js 的 localStorage 存储包成 React 状态。
 *
 * 只管「本机的封面缓存」这一件事。里面同时住着两种东西：
 *   · data URL —— 路线 0 兜底模式下选的图，或 relay 上传成功后的本地副本
 *   · https URL —— relay 上传成功时返回的 GitHub Pages 图片地址
 * 两者都能直接塞进 <img src>，所以卡片不必区分。
 */
import { useCallback, useMemo, useState } from "react";
import {
  LOCAL_COVER_ENABLED,
  dataUrlBytes,
  loadLocalCovers,
  removeLocalCover,
  saveLocalCover,
} from "../lib/localCover";

export function useLocalCovers() {
  const [covers, setCovers] = useState(() => loadLocalCovers());

  /** 重新从 localStorage 读一遍（清空、手动改过之后用） */
  const reload = useCallback(() => setCovers(loadLocalCovers()), []);

  const save = useCallback((eventId, src) => {
    saveLocalCover(eventId, src); // 可能抛 QuotaExceeded，交给调用方提示
    setCovers(loadLocalCovers());
  }, []);

  const remove = useCallback((eventId) => {
    removeLocalCover(eventId);
    setCovers(loadLocalCovers());
  }, []);

  /** 统计一下本机占了多少空间 —— 「兜底模式的代价」这件事最好在界面上说清楚 */
  const bytes = useMemo(
    () =>
      Object.values(covers).reduce(
        (n, src) => n + (String(src).startsWith("data:") ? dataUrlBytes(src) : 0),
        0
      ),
    [covers]
  );

  return { enabled: LOCAL_COVER_ENABLED, covers, save, remove, reload, bytes };
}
