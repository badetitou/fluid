type Env = Record<string, string | undefined>;

export function shouldOpenBrowser(open: boolean, env: Env, platform: string): boolean {
  if (!open) return false;
  if (env.BROWSER === 'none') return false;
  if (env.CI) return false;
  if (platform === 'linux' && !env.DISPLAY && !env.WAYLAND_DISPLAY) return false;
  return true;
}

export function browserCommand(platform: string, url: string): { command: string; args: string[] } {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '""', url] };
  return { command: 'xdg-open', args: [url] };
}
