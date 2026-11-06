import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

export function windowsProxy(settings) {
  if (Number(settings?.ProxyEnable) !== 1 || typeof settings.ProxyServer !== 'string') return null;
  const entries = settings.ProxyServer.split(';').map(s => s.trim()).filter(Boolean);
  const target = entries.find(s => s.startsWith('https='))?.slice(6) || entries.find(s => s.startsWith('http='))?.slice(5) || entries.find(s => !s.includes('='));
  if (!target || /[\s\r\n]/.test(target)) return null;
  try {const url = new URL(target.includes('://') ? target : 'http://' + target);return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash ? url.origin : null;} catch {return null;}
}

// gh and other CLI clients do not automatically inherit Windows' browser proxy.
// Honor the user's existing route for this process only; never change OS settings.
export async function releaseNetworkEnv(base = process.env, {platform = process.platform, readSettings} = {}) {
  const env = {...base};
  if (['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy'].some(k => env[k])) return {env, source: 'environment'};
  if (platform !== 'win32') return {env, source: 'default'};
  try {
    const settings = await (readSettings || (async () => JSON.parse((await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' | Select-Object ProxyEnable,ProxyServer | ConvertTo-Json -Compress"], {windowsHide: true, timeout: 10000, maxBuffer: 8192})).stdout)))();
    const proxy = windowsProxy(settings);
    if (proxy) {env.HTTPS_PROXY = proxy;env.HTTP_PROXY = proxy;env.NO_PROXY ||= 'localhost,127.0.0.1,::1';return {env, source: 'windows-system-proxy'};}
  } catch { /* No readable manual system proxy; bounded channel probe remains mandatory. */ }
  return {env, source: 'default'};
}
