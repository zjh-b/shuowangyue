import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { playtestSummary } from '../game/playtest';

const topics = [
  '线索太少，猜不出规则',
  '看不懂牌面或判定',
  '猜出规则后仍很难赢',
  '牌局节奏慢或重复',
  '操作或显示有问题',
  '其他建议',
];

const formId = import.meta.env.VITE_FEEDBACK_FORM_ID?.trim() ?? '';
const online = !document.documentElement.hasAttribute('data-offline-build') && /^[a-z0-9]{6,32}$/i.test(formId);
const endpoint = `https://formspree.io/f/${formId}`;

export function PlaytestFeedback({ summary, onClose }: { summary: ReturnType<typeof playtestSummary> | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [attachSummary, setAttachSummary] = useState(false);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  useLayoutEffect(() => {
    if (summary) dialog.current?.showModal();
  }, [summary]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !topics.includes(topic)) return;
    const payload = {
      gameVersion: __GAME_VERSION__,
      topic,
      message: message.trim(),
      ...(attachSummary && { summary: JSON.stringify(summary) }),
    };
    if (!online) {
      const file = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = '朔望月-试玩反馈.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('反馈文件已生成，可以发给开发者。');
      return;
    }

    inFlight.current = true;
    setSending(true);
    setStatus('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        credentials: 'omit',
        redirect: 'error',
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        setStatus(response.status === 429 ? '提交太频繁，请稍后重试。' : '提交失败，内容已保留，可以重试。');
        return;
      }
      setStatus('反馈已提交，谢谢你。');
      setTopic('');
      setMessage('');
      setAttachSummary(false);
    } catch {
      setStatus('提交失败，内容已保留。请检查网络后重试。');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return <dialog className="onboarding feedback-dialog" ref={dialog} onClose={onClose} aria-labelledby="feedback-title">
    {summary && <form onSubmit={submit}>
      <header className="onboarding-header">
        <h2 id="feedback-title">试玩反馈</h2>
        <button className="text-button onboarding-close" type="button" onClick={() => dialog.current?.close()}>关闭</button>
      </header>
      <div className="onboarding-body feedback-fields">
        <p className="muted">
          {online ? <>提交后，反馈会经 Formspree 发送给开发者。请勿填写联系方式。
            {' '}<a href="https://formspree.io/legal/privacy-policy/" target="_blank" rel="noreferrer">隐私说明</a></>
            : '可以下载反馈文件并发给开发者。请勿填写联系方式。'}
        </p>
        <div className="feedback-field">
          <label htmlFor="feedback-topic">哪里最影响体验？</label>
          <select id="feedback-topic" value={topic} required disabled={sending} onChange={event => setTopic(event.target.value)}>
            <option value="">选择一项</option>
            {topics.map(item => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="feedback-field">
          <label htmlFor="feedback-message">想补充什么？ <span className="muted">选填</span></label>
          <textarea id="feedback-message" value={message} disabled={sending} maxLength={500} rows={3}
            placeholder="例如，第5手我猜对了规则，却不知道该不该挑战。"
            onChange={event => setMessage(event.target.value)} />
        </div>
        <div className="feedback-attachment">
          <label className="feedback-consent">
            <input type="checkbox" checked={attachSummary} disabled={sending}
              onChange={event => setAttachSummary(event.target.checked)} />
            附上本场对局摘要
          </label>
          <details>
            <summary>预览对局摘要</summary>
            <dl>{Object.entries(summary).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </details>
        </div>
      </div>
      <footer className="onboarding-footer feedback-footer">
        <p role="status" className="muted">{status}</p>
        <button className="primary" type="submit" disabled={sending || !topic}>
          {online ? sending ? '提交中…' : '提交反馈' : '下载反馈'}
        </button>
      </footer>
    </form>}
  </dialog>;
}
