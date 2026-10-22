import React from 'react';
import { createRoot } from 'react-dom/client';
import { SupportApp } from './SupportApp.jsx';
import './support.css';

createRoot(document.getElementById('support-root')).render(<SupportApp />);
