import React from 'react';
import ReactDOM from 'react-dom/client';
import "./index.css"
import App from './components/App';
import { io } from 'socket.io-client';

const root = ReactDOM.createRoot(document.getElementById('root'));
const socket = io('http://localhost:8080');

root.render(
  <App socket={socket}/>
);