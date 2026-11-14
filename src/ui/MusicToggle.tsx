import { useEffect, useRef, useState } from 'react';
import type { RecordEntry } from '../game/match';
import musicUrl from '../audio/eastminster.mp3';
import turnUrl from '../audio/card-turn.mp3';

const MUSIC_LEVEL = 0.22;

export function MusicToggle({ showdown, playerTurn = false }: { showdown?: RecordEntry; playerTurn?: boolean }) {
  const music = useRef<HTMLAudioElement>(null);
  const turn = useRef<HTMLAudioElement>(null);
  const previousShowdown = useRef(showdown);
  const previousTurn = useRef(playerTurn);
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const isNewShowdown = showdown && showdown !== previousShowdown.current;
    const isNewTurn = playerTurn && !previousTurn.current;
    previousShowdown.current = showdown;
    previousTurn.current = playerTurn;
    if ((!isNewShowdown && !isNewTurn) || !on || music.current?.paused) return;
    const background = music.current!;
    const effect = turn.current!;
    background.volume = 0.08;
    effect.volume = 0.35;
    effect.currentTime = 0;
    void effect.play().catch(() => {});
    const restore = window.setTimeout(() => { background.volume = MUSIC_LEVEL; }, 440);
    return () => {
      window.clearTimeout(restore);
      background.volume = MUSIC_LEVEL;
    };
  }, [showdown, playerTurn, on]);

  function toggle() {
    const audio = music.current!;
    setFailed(false);
    if (on) {
      audio.pause();
      turn.current?.pause();
      setOn(false);
      return;
    }
    audio.volume = MUSIC_LEVEL;
    setOn(true);
    void audio.play().catch(error => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setOn(false);
      setFailed(true);
    });
  }

  return <>
    <audio ref={music} src={musicUrl} preload="none" loop onError={() => { setFailed(true); setOn(false); }} />
    <audio ref={turn} src={turnUrl} preload="none" />
    <button className="text-button music-toggle" aria-pressed={on} onClick={toggle}>
      {failed ? '重试配乐' : on ? '配乐开' : '配乐关'}
    </button>
  </>;
}
