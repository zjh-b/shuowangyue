import { useRef, useState } from 'react';

const offline = document.documentElement.hasAttribute('data-offline-build');

export function ShareGame() {
  const dialog = useRef<HTMLDialogElement>(null);
  const linkField = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const address = new URL(location.href);
  address.search = '';
  address.hash = '';
  const gameUrl = address.href;
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname);
  const canShare = !offline && !loopback && typeof navigator.share === 'function';

  function open() {
    setStatus('');
    dialog.current?.showModal();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(gameUrl);
      setStatus('链接已复制。');
    } catch {
      linkField.current?.focus();
      linkField.current?.select();
      setStatus('已选中链接，可以手动复制。');
    }
  }

  async function share() {
    try {
      await navigator.share({ title: '朔望月 · 八手之间', url: gameUrl });
      dialog.current?.close();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus('暂时无法打开分享菜单，可以复制链接。');
    }
  }

  function saveOffline() {
    // The portable build keeps all executable code and media in the head.
    // A fresh mount point omits the current game's rendered content.
    const file = new Blob(['<!doctype html>\n<html lang="zh-CN" data-offline-build>\n', document.head.outerHTML,
      '\n<body><div id="root"></div></body>\n</html>\n'], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = '朔望月-双击试玩.html';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <>
    <button className="text-button" onClick={open}>分享</button>
    <dialog className="onboarding share-dialog" ref={dialog} aria-labelledby="share-title">
      <header className="onboarding-header">
        <h2 id="share-title">分享朔望月</h2>
        <button className="text-button onboarding-close" onClick={() => dialog.current?.close()}>关闭</button>
      </header>
      <div className="onboarding-body">
        {offline ? <p>把试玩文件发给朋友。对方保存文件后，用浏览器打开即可游玩。电脑上可以直接双击。</p>
          : <>
            <p>{loopback ? '当前是本机预览地址。部署后可把正式链接发给朋友。'
              : '朋友打开链接即可入局。对局进度保存在各自的浏览器。'}</p>
            <label className="share-link-label" htmlFor="share-link">游戏链接</label>
            <input id="share-link" type="url" ref={linkField} value={gameUrl} readOnly onFocus={event => event.currentTarget.select()} />
          </>}
        <p className="share-status" role="status">{status}</p>
      </div>
      <footer className="onboarding-footer">
        {offline ? <button className="primary" onClick={saveOffline}>保存试玩文件</button>
          : <>
            {canShare && <button className="secondary" onClick={share}>系统分享</button>}
            <button className="primary" onClick={copy}>复制链接</button>
          </>}
      </footer>
    </dialog>
  </>;
}
