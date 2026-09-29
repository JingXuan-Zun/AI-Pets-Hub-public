import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPersonaCommunityClient, personaCommunityErrorMessage } from '../../persona-community/personaCommunityClient';
import { savePersonaDownload } from '../../persona-community/personaCommunityDownload';
import type { PublicPersonaEntry } from '../../persona-community/personaCommunityTypes';

export function usePersonaCommunity(apiUrl: string) {
  const client = useMemo(() => createPersonaCommunityClient({ apiUrl }), [apiUrl]);
  const [entries, setEntries] = useState<PublicPersonaEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(apiUrl));
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const requests = useRef(new Set<AbortController>());
  const listRequest = useRef<AbortController | null>(null);
  const uploadLock = useRef(false);
  const downloadLock = useRef(false);

  const refresh = useCallback(async () => {
    if (!apiUrl || listRequest.current || uploadLock.current) return;
    const controller = new AbortController();
    requests.current.add(controller);
    listRequest.current = controller;
    setLoading(true);
    try {
      const items = await client.list(controller.signal);
      if (!controller.signal.aborted) { setEntries(items); setLoadError(''); }
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(personaCommunityErrorMessage(error, '暂时无法加载分享列表，请稍后刷新。'));
    } finally {
      requests.current.delete(controller);
      if (listRequest.current === controller) { listRequest.current = null; setLoading(false); }
    }
  }, [apiUrl, client]);

  useEffect(() => {
    void refresh();
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(visibleRefresh, 60000);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibleRefresh);
      for (const controller of requests.current) controller.abort();
      requests.current.clear();
      listRequest.current = null;
    };
  }, [refresh]);

  const upload = async (file: File) => {
    if (uploadLock.current) return;
    if (!apiUrl) { setMessage('人格分享暂未开放，请稍后再试。'); return; }
    uploadLock.current = true;
    listRequest.current?.abort();
    listRequest.current = null;
    setLoading(false);
    const controller = new AbortController();
    requests.current.add(controller);
    setUploading(true);
    setMessage('正在上传…');
    try {
      const entry = await client.upload(file, controller.signal);
      if (controller.signal.aborted) return;
      setEntries((previous) => [entry, ...previous.filter((item) => item.id !== entry.id)]);
      setMessage('分享已发布，其他用户刷新列表即可下载。');
      setLoadError('');
    } catch (error) {
      if (!controller.signal.aborted) setMessage(personaCommunityErrorMessage(error, '暂时无法确认上传结果。请刷新列表查看；重试同一文件不会重复发布。'));
    } finally {
      requests.current.delete(controller);
      uploadLock.current = false;
      if (!controller.signal.aborted) setUploading(false);
    }
  };

  const download = async (entry: PublicPersonaEntry) => {
    if (downloadLock.current) return;
    downloadLock.current = true;
    const controller = new AbortController();
    requests.current.add(controller);
    setDownloading(entry.id);
    try {
      const result = await client.download(entry, controller.signal);
      if (!controller.signal.aborted) { savePersonaDownload(result.blob, result.filename); setMessage('已开始保存文件。'); }
    } catch (error) {
      if (!controller.signal.aborted) setMessage(personaCommunityErrorMessage(error, '下载失败，请稍后重试。'));
    } finally {
      requests.current.delete(controller);
      downloadLock.current = false;
      if (!controller.signal.aborted) setDownloading(null);
    }
  };

  return { entries, loading, uploading, downloading, message, loadError, refresh, upload, download };
}
