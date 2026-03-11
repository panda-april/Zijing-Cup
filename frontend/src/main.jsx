import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // 👈 引入路由引擎
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 👈 用 BrowserRouter 包裹 App */}
    <BrowserRouter> 
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
