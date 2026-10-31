import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Admin from './Admin.jsx'
import PublicSchedule from './Schedule.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/"          element={<App />} />
        <Route path="/admin"     element={<Admin />} />
        <Route path="/schedule"  element={<PublicSchedule />} />
        <Route path="/coverage"  element={<PublicSchedule />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
)
