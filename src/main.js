import { mount } from 'svelte'
import App from './App.svelte'
import AppV2 from './ui-v2/AppV2.svelte'

// ?v2=1 opts into the Phase 1.5 shell; default stays on the current three-pane App.
const useV2 = new URLSearchParams(window.location.search).get('v2') === '1'
const Root = useV2 ? AppV2 : App

const app = mount(Root, {
  target: document.getElementById('app'),
})

export default app
