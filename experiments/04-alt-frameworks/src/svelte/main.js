import '../theme.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { markStart } from '../shared.js'

markStart()

// Seeded from the OS preference, as every other track does, so the four are not compared across
// two different palettes.
document.documentElement.setAttribute(
  'data-theme',
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
)

mount(App, { target: document.getElementById('root') })
