const path = require('node:path');

// FileSystem handles are capabilities created by Chromium's user-controlled
// picker/drop flow. Restoring one from IndexedDB does not restore its grant.
// Keep reads usable in Folio's own origin; never grant access to another origin.
function installFilePermissions(session, {origin, getWebContents}) {
  const isOrigin = value => { try { const u = new URL(value); return u.origin === origin && !u.username && !u.password; } catch { return false; } };
  function trusted(wc, requestingOrigin) {
    const main = getWebContents();
    return main && !main.isDestroyed() && (!wc || wc === main) && isOrigin(main.getURL()) && isOrigin(requestingOrigin);
  }
  const validPath = details => typeof details.filePath === 'string' && path.isAbsolute(details.filePath);
  session.setPermissionCheckHandler((wc, permission, requestingOrigin, details) => {
    if (permission !== 'fileSystem' || !trusted(wc, requestingOrigin) || !validPath(details)) return false;
    // Electron supplies null WebContents and isMainFrame=false for these checks.
    return details.fileAccessType === 'readable';
  });
  session.setPermissionRequestHandler((wc, permission, callback, details) => {
    // Chromium enforces user activation before invoking this for requestPermission.
    // Writes are requested by the explicit import action, never by startup.
    const allowed = permission === 'fileSystem' && wc === getWebContents() && trusted(wc, details.requestingUrl) && validPath(details) && ['readable', 'writable'].includes(details.fileAccessType);
    callback(Boolean(allowed));
  });
  // Electron's check handler cannot return "prompt": false is a hard denial.
  // Restore native grant handling after the initial read-only catalog scan, so
  // opening a document and explicitly importing files can renew their grants.
  return () => session.setPermissionCheckHandler(null);
}

module.exports = {installFilePermissions};
