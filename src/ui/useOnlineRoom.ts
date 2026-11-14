import { useEffect, useRef, useState } from 'react';
import type { RoomCommand, RoomView } from '../game/roomProtocol';
import type { SeatCount } from '../game/roomTable';
import {
  checkRoomService, createOnlineRoom, createSeatKey, getOnlineRoom, inviteCode,
  removeTicket, roomAddress, RoomRequestError, savedTicket, saveTicket, sendRoomCommand, type RoomTicket,
} from './roomClient';

function failureText(error: unknown) {
  return error instanceof RoomRequestError ? error.message : '连接失败。请检查网络后重试。';
}

export function useOnlineRoom() {
  const [ticket, setTicket] = useState(() => inviteCode ? savedTicket(inviteCode) : null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [service, setService] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [check, retryService] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reconnecting, setReconnecting] = useState(false);
  const creating = useRef('');
  const joining = useRef(new Map<string, string>());
  const inFlight = useRef(false);
  const requestVersion = useRef(0);

  function applyView(view: RoomView) {
    setRoom(view);
    setDeadline(view.deadline === null ? null : Date.now() + view.deadline - view.serverTime);
  }

  useEffect(() => {
    if (ticket) return;
    const abort = new AbortController();
    setService('checking');
    void checkRoomService(abort.signal).then(response => {
      if (!abort.signal.aborted) setService(response.ok ? 'ready' : 'unavailable');
    }).catch(() => {
      if (!abort.signal.aborted) setService('unavailable');
    });
    return () => abort.abort();
  }, [check, ticket]);

  useEffect(() => {
    if (!ticket) return;
    const saved = ticket;
    const abort = new AbortController();
    let timer = 0;
    let polling = false;
    async function poll() {
      if (abort.signal.aborted || polling) return;
      window.clearTimeout(timer);
      polling = true;
      const version = requestVersion.current;
      let expired = false;
      try {
        if (!inFlight.current) {
          const view = await getOnlineRoom(saved, abort.signal);
          if (!abort.signal.aborted && version === requestVersion.current) {
            applyView(view);
            setReconnecting(false);
          }
        }
      } catch (error) {
        if (abort.signal.aborted || version !== requestVersion.current) return;
        const status = error instanceof RoomRequestError ? error.status : 0;
        if ([401, 403, 404].includes(status)) {
          removeTicket(saved.code);
          setTicket(null);
          setRoom(null);
          setError(failureText(error));
          expired = true;
          return;
        }
        if (status !== 409) setReconnecting(true);
      } finally {
        polling = false;
        if (!abort.signal.aborted && !expired) timer = window.setTimeout(poll, document.hidden ? 5000 : 1100);
      }
    }
    function wake() {
      if (!document.hidden) void poll();
    }
    void poll();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      abort.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [ticket]);

  async function mutate(operation: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    requestVersion.current++;
    setBusy(true);
    setError('');
    try {
      await operation();
      setReconnecting(false);
    } catch (error) {
      setError(failureText(error));
    } finally {
      requestVersion.current++;
      inFlight.current = false;
      setBusy(false);
    }
  }

  function seated(view: RoomView, key: string) {
    const saved = { code: view.code, key };
    saveTicket(saved);
    history.replaceState(null, '', roomAddress(view.code));
    setTicket(saved);
    applyView(view);
  }

  function resume(saved: RoomTicket) {
    setError('');
    history.replaceState(null, '', roomAddress(saved.code));
    setTicket(saved);
  }

  function create(size: SeatCount, name: string) {
    if (!creating.current) creating.current = createSeatKey();
    const key = creating.current;
    return mutate(async () => {
      seated(await createOnlineRoom(size, name, key), key);
      creating.current = '';
    });
  }

  function join(code: string, name: string) {
    const key = savedTicket(code)?.key ?? joining.current.get(code) ?? createSeatKey();
    joining.current.set(code, key);
    return mutate(async () => {
      seated(await sendRoomCommand({ code, key }, { kind: 'join', name }), key);
      joining.current.delete(code);
    });
  }

  function play(command: RoomCommand) {
    if (!ticket || !room) return;
    const saved = ticket;
    return mutate(async () => {
      if (command.kind === 'leave') {
        await sendRoomCommand<{ ok: boolean }>(saved, command);
        removeTicket(saved.code);
        history.replaceState(null, '', roomAddress());
        setTicket(null);
        setRoom(null);
        return;
      }
      applyView(await sendRoomCommand(saved, command));
    });
  }

  return {
    ticket, room, deadline, service, reconnecting, busy, error, create, join, play, resume,
    retry: () => retryService(value => value + 1),
  };
}
