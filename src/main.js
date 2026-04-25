import { mount } from 'svelte'
import App from './ui-v2/AppV2.svelte'

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
