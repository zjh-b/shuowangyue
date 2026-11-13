import { dateOf, digitsOf, type Card } from '../game/cards';
import back from '../art/back.webp';

const artwork = import.meta.glob<string>('../art/cards/*.webp', { eager: true, import: 'default' });
const artNames: Record<string, string> = {
  立春: 'lichun', 雨水: 'yushui', 惊蛰: 'jingzhe', 春分: 'chunfen', 清明: 'qingming', 谷雨: 'guyu',
  立夏: 'lixia', 小满: 'xiaoman', 芒种: 'mangzhong', 夏至: 'xiazhi', 小暑: 'xiaoshu', 大暑: 'dashu',
  立秋: 'liqiu', 处暑: 'chushu', 白露: 'bailu', 秋分: 'qiufen', 寒露: 'hanlu', 霜降: 'shuangjiang',
  立冬: 'lidong', 小雪: 'xiaoxue', 大雪: 'daxue', 冬至: 'dongzhi', 小寒: 'xiaohan', 大寒: 'dahan',
  春节: 'chunjie', 元宵: 'yuanxiao', 社日: 'sheri', 上巳: 'shangsi', 端午: 'duanwu', 七夕: 'qixi',
  中元: 'zhongyuan', 中秋: 'zhongqiu', 重阳: 'chongyang', 下元: 'xiayuan', 腊八: 'laba', 除夕: 'chuxi',
};

export function PlayingCard({ value, label, small = false }: { value: Card | null; label?: string; small?: boolean }) {
  const art = value && artwork[`../art/cards/${artNames[value.id]}.webp`];
  return <div className={`card-slot${small ? ' card-slot-small' : ''}`}>
    <div className={`playing-card${value ? '' : ' card-back'}`} role="img"
      aria-label={value ? [label, value.name, value.kind, dateOf(value), `数字 ${digitsOf(value).join('、')}`].filter(Boolean).join('，')
        : '地猴暗牌，尚未公开'}>
      {value ? <>
        <strong className="card-name">{value.name}</strong>
        <div className="card-art">{art && <img src={art} alt="" />}</div>
        <div className="card-bottom">
          <span>{dateOf(value)}</span>
          <span className="card-digits">{digitsOf(value).join(' · ')}</span>
        </div>
      </> : <img src={back} alt="" />}
    </div>
    {label && <span className="card-label" aria-hidden="true">{label}</span>}
  </div>;
}
