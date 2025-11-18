import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/index.css'
import App from './App'
import { ToastProvider } from './components/Toast'


ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ToastProvider>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </ToastProvider>
    </React.StrictMode>
)