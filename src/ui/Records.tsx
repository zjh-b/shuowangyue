import { CARDS, dateOf, digitsOf } from '../game/cards';
import { compareHands, RULE_NAMES, RULES, type Rule, type Score } from '../game/rules';
import type { PublicRecord } from '../game/views';
import { moveText, outcome, RULE_COPY } from './gameCopy';

export function RuleBook({ onGuide }: { onGuide: (trigger: HTMLButtonElement) => void }) {
  return <div className="rulebook">
    <h2>三种可能的法则</h2>
    <p className="muted">本场只采用其中一种，八手固定。所有三张牌的数字都参与计算。</p>
    <button className="text-button" onClick={event => onGuide(event.currentTarget)}>新手指导</button>
    {RULES.map(rule => <section key={rule}><h3>{RULE_NAMES[rule]}</h3><p>{RULE_COPY[rule]}</p></section>)}
    <section><h3>顺子怎么比</h3><p>至少三个不同数字连续，取最长一段。重复数字只用一次，0可参与，9不接0。长度相同且其他指标也相同，平分底池。</p></section>
    <section><h3>地猴的透视与挑战</h3><p>地猴知道法则，也看得见你的底牌。每半场你有一次挑战，可随开注或加注声明，迫使它跟注后立即摊牌。额度在第5手重置。</p></section>
    <section><h3>秘密换暗牌</h3><p>第5–8手，在轮到你进行当手第一次行动时，可以从未发牌中随机换一张暗牌。每场一次，可接着挑战。地猴继续按原暗牌下注，结算与验牌用新暗牌。</p></section>
    <section><h3>八手与筹码</h3><p>每人32道，每手各付1道底注。前四手每次加1道，后四手每次加2道。每手最多加注一次。打完八手，多于32道为胜，等于32道为和。</p></section>
    <details>
      <summary>查看36张固定牌表</summary>
      <div className="deck-list">{CARDS.map(card => <div key={card.id}><b>{card.name}</b><span>{dateOf(card)}</span><span>{digitsOf(card).join(' · ')}</span></div>)}</div>
      <p className="muted">日期为本游戏固定计分表。小寒与腊八是不同的牌，数字相同。</p>
    </details>
    <details>
      <summary>配乐署名</summary>
      <p className="muted">《Eastminster》· Kevin MacLeod。游戏版重编码为低码率 MP3，循环播放。<br />
        <a href="https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1100719" target="_blank" rel="noreferrer">作者与原曲</a>
        {' · '}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
      </p>
    </details>
  </div>;
}

function scoreText(score: Score) {
  return `总点${score.sum} · ${score.repeats}个${score.repeatedDigit} · 顺子${score.straight} · 距24为${score.distance}`;
}

export function History({ entries, rule }: { entries: PublicRecord[]; rule?: Rule }) {
  return <div className="history">
    <h2>牌局记录</h2>
    {!entries.length && <p className="muted">第一手结束后，公开的牌面和行动会记在这里。</p>}
    {[...entries].reverse().map(entry => {
      const [open, hole] = entry.cards[1];
      const result = rule && hole ? compareHands(rule, entry.publicCard, entry.cards[0], [open, hole]) : null;
      const before = rule && hole && entry.swap
        ? compareHands(rule, entry.publicCard, [entry.cards[0][0], entry.swap.from], [open, hole]) : null;
      return <details id={`history-hand-${entry.hand}`} key={entry.hand} open={entries.length === 1}>
        <summary><span>第{entry.hand + 1}手</span><strong>{entry.winner === null ? '平局' : entry.winner === 0 ? '你获池' : '地猴获池'}</strong><span>{entry.reason === 'fold' ? '弃牌结算' : '摊牌'}</span></summary>
        <div className="history-body">
          <p>公共牌 <b>{entry.publicCard.name}</b></p>
          <p>你 <b>{entry.cards[0].map(card => card.name).join('、')}</b></p>
          <p>地猴 <b>{entry.cards[1].map(card => card?.name ?? '暗牌未公开').join('、')}</b></p>
          {entry.swap && <p className="muted">秘密换牌 · {entry.swap.from.name} → {entry.swap.to.name}。地猴按原暗牌下注。</p>}
          <ul className="moves">{entry.moves.map((move, i) => <li key={i}>{moveText(move)}</li>)}</ul>
          {entry.inspectionVerdict !== undefined && <p className="muted">已验牌 · 假想摊牌{outcome(entry.inspectionVerdict)}。筹码按弃牌结算。</p>}
          {result && <div className="explanation">
            <p>{entry.reason === 'fold' ? '若按牌力比较' : '本手判定'} · {outcome(result.winner)}，依据{result.criterion}。</p>
            <p>你 {scoreText(result.scores[0])}</p>
            <p>地猴 {scoreText(result.scores[1])}</p>
            {before && <p>按旧暗牌比较：{outcome(before.winner)}。按新暗牌比较：{outcome(result.winner)}。</p>}
          </div>}
          <p className="muted">结算后，你 {entry.banks[0]}道 · 地猴 {entry.banks[1]}道</p>
        </div>
      </details>;
    })}
  </div>;
}
