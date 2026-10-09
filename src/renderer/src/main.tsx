import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import QuickBar from './QuickBar'
import '@fontsource/knewave'
import './styles.css'

// The same screen code powers both windows; "#quick" means the pop-up bar.
const isQuick = window.location.hash === '#quick'
document.body.classList.add(isQuick ? 'is-quick' : 'is-full')

createRoot(document.getElementById('root')!).render(<StrictMode>{isQuick ? <QuickBar /> : <App />}</StrictMode>)
