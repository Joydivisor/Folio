const fs = require('node:fs/promises');
const path = require('node:path');

function officialEndpoint(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'api.deepseek.com' || url.port || url.username || url.password || url.search || url.hash || !['/', '/v1', '/v1/'].includes(url.pathname)) {
    throw new Error('桌面密钥仅可用于 https://api.deepseek.com，不能发送到其他地址。');
  }
  return url.origin + url.pathname.replace(/\/$/, '');
}
function createVault(directory, crypto) {
  const file = path.join(directory, 'deepseek-key.bin');
  let key = '', persisted = false;
  const status = () => ({ configured: Boolean(key), persisted });
  const protectedBackend = () => !['basic_text','unknown'].includes(crypto.getSelectedStorageBackend?.());
  return {
    status,
    async load() {
      if(!protectedBackend())return status();
      try { key = await crypto.decryptStringAsync(await fs.readFile(file)); persisted = true; }
      catch { key = ''; persisted = false; }
      return status();
    },
    async save(value, remember) {
      if (typeof value !== 'string' || value.length > 512 || /[\r\n]/.test(value)) throw new Error('密钥格式不正确。');
      const next = value.trim() || key;
      if (remember && next) {
        if (!protectedBackend() || !await crypto.isAsyncEncryptionAvailable()) throw new Error('系统密钥库不可用；请取消本机保存，仅在本次运行使用。');
        const encrypted = await crypto.encryptStringAsync(next);
        await fs.writeFile(file + '.tmp', encrypted);
        await fs.rename(file + '.tmp', file);
      } else await fs.rm(file, { force: true });
      key = next; persisted = Boolean(remember && next); return status();
    },
    async forget() { await fs.rm(file, { force: true }); key = ''; persisted = false; return status(); },
    config(config) { return { baseUrl: officialEndpoint(config.baseUrl), model: String(config.model).slice(0, 100), thinking: Boolean(config.thinking), answerLanguage:['en','zh-CN'].includes(config.answerLanguage)?config.answerLanguage:'auto', ...(config.responseFormat==='json'?{responseFormat:'json'}:{}), apiKey: key }; },
  };
}
module.exports = { createVault, officialEndpoint };
