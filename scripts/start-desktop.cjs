const { spawn } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [path.resolve(__dirname, '..')], { env, stdio: 'inherit' });
child.on('exit', code => process.exit(code || 0));
child.on('error', error => { console.error(error.message); process.exit(1); });
