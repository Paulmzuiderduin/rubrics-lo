import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import PrintGuide from './PrintGuide.jsx';
import './styles.css';
import './print.css';

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /><PrintGuide /></React.StrictMode>);
