import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import { OnlineRooms } from './ui/OnlineRooms';
import { inviteCode, offlineRoomBuild } from './ui/roomClient';
import './ui/style.css';
import './ui/rooms.css';

const multiplayer = !offlineRoomBuild && (inviteCode || new URLSearchParams(location.search).get('play') === 'online');
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{multiplayer ? <OnlineRooms /> : <App />}</React.StrictMode>);
