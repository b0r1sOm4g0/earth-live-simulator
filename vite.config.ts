import { defineConfig } from 'vitest/config'

// Duas páginas: o app (index.html) e o spike descartável (spike.html).
// defineConfig vem de 'vitest/config' para tipar também a chave `test`.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        spike: 'spike.html',
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
