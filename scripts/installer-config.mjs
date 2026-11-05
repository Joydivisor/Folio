import fs from 'node:fs';
import path from 'node:path';

export const updateFeed = {provider: 'github', owner: 'Joydivisor', repo: 'Folio', releaseType: 'release'};

export function writeUpdateConfig(payload) {
  fs.writeFileSync(path.join(payload, 'resources', 'app-update.yml'),
    Object.entries({...updateFeed, updaterCacheDirName: 'folio-updater'}).map(([key, value]) => `${key}: ${value}`).join('\n') + '\n');
}

export function windowsInstallerConfig(root, version) {
  return {
    appId: 'local.folio.reading', productName: 'Folio',
    directories: {output: path.join(root, 'releases', 'v' + version), buildResources: path.join(root, 'build')},
    artifactName: 'Folio-Setup-${version}-win-${arch}.${ext}',
    publish: [updateFeed],
    win: {icon: path.join(root, 'build', 'folio.ico'), target: 'nsis', signExecutable: false, electronUpdaterCompatibility: '>=6.8.11'},
    nsis: {
      oneClick: false, perMachine: false, allowElevation: false, allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true, createStartMenuShortcut: true, shortcutName: 'Folio',
      deleteAppDataOnUninstall: false, differentialPackage: true, runAfterFinish: false,
      installerLanguages: ['en_US', 'zh_CN'], displayLanguageSelector: true,
    },
  };
}
