/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function serviceWorker(): Plugin {
  return {
    name: 'swipie-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'))
      const publicFiles = [
        'manifest.webmanifest',
        'icon.svg',
        'icon-192.png',
        'icon-512.png',
        'apple-touch-icon.png',
      ]
      const assets = ['./', ...[...files, ...publicFiles].map((f) => `./${f}`)]
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 10)
      const source = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8')
        .replace('__SW_VERSION__', JSON.stringify(version))
        .replace('__SW_ASSETS__', JSON.stringify(assets))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
