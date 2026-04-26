import { mount } from 'svelte'
import App from './ui-v2/AppV2.svelte'
import { applyTheme, getTheme, setupSystemThemeListener } from './lib/theme.js'

// Apply the persisted theme before mount so there's no light→dark flash.
applyTheme(getTheme())
setupSystemThemeListener()

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
