import React from 'react';
import ReactDOM from 'react-dom/client';
import "./index.css"
import App from './components/App';
import { io } from 'socket.io-client';

const root = ReactDOM.createRoot(document.getElementById('root'));
const socket = io('http://localhost:3002');
// const socket = io('https://bluej.memgraph.com/viz/socket');

root.render(
  <App socket={socket}/>
);