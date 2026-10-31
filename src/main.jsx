import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Admin from './Admin.jsx'
import PublicSchedule from './Schedule.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary title="2323 KvK Application Error">
      <HashRouter>
        <Routes>
          <Route path="/"          element={<ErrorBoundary title="Booking Form Error"><App /></ErrorBoundary>} />
          <Route path="/admin"     element={<ErrorBoundary title="Admin Dashboard Error"><Admin /></ErrorBoundary>} />
          <Route path="/schedule"  element={<ErrorBoundary title="Schedule Coverage Error"><PublicSchedule /></ErrorBoundary>} />
          <Route path="/coverage"  element={<ErrorBoundary title="Schedule Coverage Error"><PublicSchedule /></ErrorBoundary>} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
