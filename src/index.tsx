import React from 'react';
import './index.scss';
import { App } from './App';
import reportWebVitals from './reportWebVitals';
import { LM } from './translations/language-manager';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

document.documentElement.setAttribute('data-theme', 'dark');


LM.init().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
