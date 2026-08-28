import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import { App } from './App'

// Before the first render, so `recipe:first-render` spans module evaluation to committed DOM
// rather than just React's work. See packages/harness/src/protocol.ts for why this is a mark
// rather than an import.
performance.mark('recipe:render:start')

// Start from what the viewer is actually seeing, exactly as tracks 01 and 03 do — otherwise the
// three tracks disagree about the default theme and Phase 08 compares two palettes.
document.documentElement.setAttribute(
  'data-theme',
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
