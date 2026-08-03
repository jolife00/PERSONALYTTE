import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // <-- ESSA LINHA É OBRIGATÓRIA PARA O VISUAL FUNCIONAR!
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)