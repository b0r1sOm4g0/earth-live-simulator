// Painel de texto no canto da tela para ler números durante o spike.
export function createDebugOverlay() {
  const el = document.getElementById('debug')!
  return {
    set(lines: Record<string, string>) {
      el.textContent = Object.entries(lines)
        .map(([k, v]) => `${k.padEnd(10)} ${v}`)
        .join('\n')
    },
  }
}
