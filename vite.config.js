import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const braveKey = env.BRAVE_API_KEY || ''

  return {
    base: process.env.BASE_PATH ? `${process.env.BASE_PATH}/` : '/',
    plugins: [svelte()],
    server: {
      proxy: {
        '/api': {
          target: 'http://eatonmediasvr.local:8888',
          changeOrigin: true,
          secure: false,
        },
        '/cdx': {
          target: 'https://web.archive.org',
          changeOrigin: true,
          secure: true,
        },
        // Brave Search: inject X-Subscription-Token on the server side so the
        // key is never sent to the browser. Path prefix is stripped.
        '/brave': {
          target: 'https://api.search.brave.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/brave/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (braveKey) proxyReq.setHeader('X-Subscription-Token', braveKey)
              proxyReq.setHeader('Accept', 'application/json')
            })
          },
        },
      }
    }
  }
})
