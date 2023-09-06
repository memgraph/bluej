import React from 'react';
import ReactDOM from 'react-dom/client';
import "./index.css"
import App from './components/App';
import { io } from 'socket.io-client';

const root = ReactDOM.createRoot(document.getElementById('root'));
const socket = io(process.env.REACT_APP_BACKEND_DOMAIN, {
  path: process.env.REACT_APP_BACKEND_PATH
});

root.render(
  <App socket={socket}/>
);