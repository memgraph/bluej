import React from 'react';
import ReactDOM from 'react-dom/client';
import "./index.css"
import App from './components/App';
import { io } from 'socket.io-client';

const interestDID = "did:plc:qczzjjs4ybu7zpvkb42yxymu";

const root = ReactDOM.createRoot(document.getElementById('root'));
const socket = io('http://localhost:8080');

socket.emit('interest', interestDID);

root.render(
  <App socket={socket}/>
);