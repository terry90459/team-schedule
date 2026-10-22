import React from 'react';
import { createRoot } from 'react-dom/client';
import { sbClient } from './lib/config';
import { App, RootSB } from './app/App';

// 進入點：有設定 Supabase → 登入流程；沒有 → 本機試用版
createRoot(document.getElementById('root')).render(sbClient ? <RootSB /> : <App />);
