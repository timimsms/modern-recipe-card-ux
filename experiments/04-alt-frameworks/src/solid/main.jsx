import '../theme.css'
import { render } from 'solid-js/web'
import { App } from './App'
import { markStart } from '../shared.js'

markStart()

document.documentElement.setAttribute(
  'data-theme',
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
)

render(() => <App />, document.getElementById('root'))
