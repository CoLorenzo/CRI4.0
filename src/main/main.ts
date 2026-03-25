/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import url from 'url';
import { app, BrowserWindow, shell, ipcMain, protocol, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { exec } from 'child_process';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { generateZip } from "../renderer/components/Download4Run"; // percorso relativo corretto
import os from 'os';
import fs from 'fs';
import { promises as fsp } from "fs";
import AdmZip from 'adm-zip';
import { generateZipNode } from '../shared/make-node';
import * as pty from 'node-pty';
import { IPty } from 'node-pty';




// In cima al file main (scope modulo)
type CurrentLab = {
  name: string;
  labsDir: string;
  labPath: string;
  zipPath: string;
};

let CURRENT_LAB: CurrentLab | null = null;

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

const sendLog = (level: 'log' | 'error' | 'warn' | 'info' | 'debug', message: string) => {
  if (mainWindow) {
    mainWindow.webContents.send('log-message', { level, message });
  }
};

const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

console.log = (...args: any[]) => {
  const message = args.map(arg => String(arg)).join(' ');
  sendLog('log', message);
  originalConsole.log(...args);
};

console.error = (...args: any[]) => {
  const message = args.map(arg => String(arg)).join(' ');
  sendLog('error', message);
  originalConsole.error(...args);
};

console.warn = (...args: any[]) => {
  const message = args.map(arg => String(arg)).join(' ');
  sendLog('warn', message);
  originalConsole.warn(...args);
};

console.info = (...args: any[]) => {
  const message = args.map(arg => String(arg)).join(' ');
  sendLog('info', message);
  originalConsole.info(...args);
};

console.debug = (...args: any[]) => {
  const message = args.map(arg => String(arg)).join(' ');
  sendLog('debug', message);
  originalConsole.debug(...args);
};


async function emptyKatharaLabs(labsDir: string) {
  try {
    const entries = await fsp.readdir(labsDir);
    await Promise.allSettled(
      entries.map((entry) =>
        fsp.rm(path.join(labsDir, entry), { recursive: true, force: true })
      )
    );
    sendLog('log', `🧹 Contenuto rimosso da: ${labsDir}`);
  } catch (err) {
    sendLog('error', `❌ Errore durante lo svuotamento: ${err}`);
  }
}

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  sendLog('log', msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

ipcMain.handle('docker-images', async () => {
  return new Promise((resolve, reject) => {
    exec('docker images --format "{{.Repository}}" | grep "^icr/"', (error, stdout, stderr) => {
      if (error) {
        resolve([]);
      } else {
        resolve(stdout.trim().split("\n"));
      }
    });
  });
});

ipcMain.handle('docker-build', async (event, arg) => {
  return new Promise((resolve, reject) => {
    console.log("BUILDING:", arg);
    exec(`docker compose -f ./containers/docker-compose.yaml build ${arg}`, (error, stdout, stderr) => {
      if (error) {
        resolve([]);
      } else {
        resolve(stdout.split("\n"));
      }
    });
  });
});

/*ipcMain.handle("simulate-attack", async (event, { container, command }) => {
  const timestamp = new Date().toLocaleString();
  console.log(`[${timestamp}] simulate-attack request`);
  console.log(`Image name received: ${container}`);
  console.log(`Command to execute: ${command}`);

  // Step 1: trova il container attivo che deriva dall'immagine specificata
  const containerName = await new Promise<string>((resolve, reject) => {
    exec(
      `docker ps --filter ancestor=${container} --format "{{.Names}}"`,
      (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Error looking for container:", stderr);
          return reject("Failed to find container for image: " + container);
        }

        const name = stdout.trim().split("\n")[0];
        if (!name) {
          console.warn("⚠️ No running container found for image:", container);
          return reject("No running container found for image: " + container);
        }

        console.log(`✅ Using container: ${name}`);
        resolve(name);
      }
    );
  });

  // Step 2: esegui il comando nel container trovato
  return new Promise((resolve, reject) => {
    exec(`docker exec ${containerName} ${command}`, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Command execution error:", stderr || error.message);
        return reject(stderr || error.message);
      }

      console.log("✅ Command output:\n" + stdout);
      resolve(stdout.trim());
    });
  });
});*/


ipcMain.handle('docker-inspect', async (event, machineName) => {
  const patterns = [
    CURRENT_LAB ? `kathara_.*_${CURRENT_LAB.name}_${machineName}_` : `_${machineName}_`,
    `_${machineName}_`
  ];

  const findContainer = async () => {
    for (const pattern of patterns) {
      const name = await new Promise<string | null>(r => {
        exec(`docker ps --filter name=${pattern} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
      });
      if (name) return name;
    }
    return await new Promise<string | null>(r => {
      exec(`docker ps --filter ancestor=${machineName} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
    });
  };

  const containerName = await findContainer();

  if (!containerName) {
    sendLog('warn', `⚠️ Could not find container for ${machineName}`);
    return [];
  }

  return new Promise((resolve) => {
    exec(`docker inspect ${containerName}`, (inspectErr, inspectStdout) => {
      if (inspectErr) {
        sendLog('error', `❌ docker inspect failed for ${containerName}: ${inspectErr.message}`);
        resolve([]);
      } else {
        try {
          resolve(JSON.parse(inspectStdout));
        } catch (e) {
          sendLog('error', `❌ Failed to parse docker inspect output: ${e}`);
          resolve([]);
        }
      }
    });
  });
});

ipcMain.handle('docker-logs', async (event, machineName) => {
  sendLog('log', `🔍 docker-logs called for: ${machineName}`);

  const patterns = [
    CURRENT_LAB ? `kathara_.*_${CURRENT_LAB.name}_${machineName}_` : `_${machineName}_`,
    `_${machineName}_`
  ];

  const findContainer = async () => {
    for (const pattern of patterns) {
      const name = await new Promise<string | null>(r => {
        exec(`docker ps --filter name=${pattern} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
      });
      if (name) return name;
    }
    return await new Promise<string | null>(r => {
      exec(`docker ps --filter ancestor=${machineName} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
    });
  };

  const containerName = await findContainer();

  if (!containerName) {
    sendLog('warn', `⚠️ Container not found for ${machineName}. Cannot get logs.`);
    return '';
  }

  return new Promise((resolve) => {
    exec(`docker logs ${containerName}`, (logsErr, logsStdout) => {
      if (logsErr) {
        sendLog('error', `❌ docker logs failed: ${logsErr.message}`);
        resolve('');
      } else {
        sendLog('log', `✅ Got logs: ${logsStdout.length} chars`);
        resolve(logsStdout);
      }
    });
  });
});


import { spawn } from 'child_process'; // metti questa importazione vicino a `import { exec } from 'child_process';`

// ...

ipcMain.handle("simulate-attack", async (event, { container, command }) => {

  const timestamp = new Date().toLocaleString();

  sendLog('log', `[${timestamp}] simulate-attack request`);

  sendLog('log', `Image name received: ${container}`);

  sendLog('log', `Raw command payload (main): ${command}`);



  let args: string[] = [];



  try {
    if (Array.isArray(command)) {
      // Respect the array structure provided by the client
      args = command.map(String);
    } else if (typeof command === 'string') {
      // Legacy string splitting
      args = command.trim().split(/[,\s]+/).filter(Boolean);
      // Only clean quotes for string-based legacy input
      args = args.map(a => a.replace(/^["']|["']$/g, '').trim()).filter(Boolean);
    } else {
      throw new Error('Invalid command type');
    }

    if (args.length === 0) {
      throw new Error('No valid command arguments.');
    }

    sendLog('log', `args for docker exec: ${JSON.stringify(args)}`);

  } catch (err: any) {
    sendLog('error', `❌ Failed to normalize command: ${err}`);
    throw err;
  }



  const resolvedName = await (async () => {
    const patterns = [
      CURRENT_LAB ? `kathara_.*_${CURRENT_LAB.name}_${container}_` : `_${container}_`,
      `_${container}_`
    ];
    for (const pattern of patterns) {
      const name = await new Promise<string | null>(r => {
        exec(`docker ps --filter name=${pattern} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
      });
      if (name) return name;
    }
    return await new Promise<string | null>(r => {
      exec(`docker ps --filter ancestor=${container} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
    });
  })();

  if (!resolvedName) {
    sendLog('warn', `⚠️ No running container found for image/name: ${container}`);
    throw new Error(`No running container found for image: ${container}`);
  }



  return new Promise((resolve, reject) => {
    const dockerArgs = ['exec', resolvedName, ...args];

    sendLog('log', `Spawning process: docker ${dockerArgs.join(' ')}`);



    const proc = spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });



    let stdout = '';

    let stderr = '';



    proc.stdout.on('data', (data) => {

      const message = data.toString();

      stdout += message;

      sendLog('log', message);

    });



    proc.stderr.on('data', (data) => {

      const message = data.toString();

      stderr += message;

      sendLog('error', message);

    });



    proc.on('close', (code) => {

      if (code !== 0) {

        const errorMessage = `❌ Command failed (code ${code}): ${stderr || `exit ${code}`}`;

        sendLog('error', errorMessage);

        return reject(errorMessage);

      }

      const successMessage = `✅ Command output: ${stdout.trim()}`;

      sendLog('log', successMessage);

      resolve(stdout.trim());

    });



    proc.on('error', (err) => {

      const errorMessage = `❌ Spawn error: ${err.message || String(err)}`;

      sendLog('error', errorMessage);

      reject(errorMessage);

    });

  });

});


ipcMain.handle('run-simulation', async (event, { machines, labInfo, sudoPassword }) => {
  sendLog('log', `machines? ${Array.isArray(machines)} ${machines?.length}`);

  // DEBUG: Check for SCADA payload
  if (Array.isArray(machines)) {
    machines.forEach(m => {
      if (m.type === 'scada') {
        sendLog('log', `[MAIN] SCADA Machine found: ${m.name}`);
        sendLog('log', `[MAIN] Industrial prop: ${!!m.industrial}`);
        if (m.industrial) {
          sendLog('log', `[MAIN] scadaProjectName: ${m.industrial.scadaProjectName}`);
          sendLog('log', `[MAIN] scadaProjectContent length: ${m.industrial.scadaProjectContent?.length}`);
        }
      }
    });
  }

  sendLog('log', `labInfo? ${JSON.stringify(labInfo)}`);

  const LAB_NAME = labInfo?.name || 'default-lab';
  const LABS_DIR = path.join(os.homedir(), 'kathara-labs');
  const ZIP_PATH = path.join(LABS_DIR, `${LAB_NAME}.zip`);
  const LAB_PATH = path.join(LABS_DIR, LAB_NAME);

  if (!fs.existsSync(LABS_DIR)) {
    fs.mkdirSync(LABS_DIR, { recursive: true });
  }

  sendLog('log', "📦 Generating ZIP...");
  await generateZipNode(machines, labInfo, ZIP_PATH);

  sendLog('log', "📂 Extracting ZIP...");
  const zip = new AdmZip(ZIP_PATH);
  zip.extractAllTo(LABS_DIR, true);

  CURRENT_LAB = { name: LAB_NAME, labsDir: LABS_DIR, labPath: LAB_PATH, zipPath: ZIP_PATH };

  sendLog('log', "🚀 Launching Kathara...");
  return new Promise((resolve, reject) => {
    sendLog('log', `📂 Launching kathara in: ${LABS_DIR}`);
    sendLog('log', `📂 Launching kathara in: ${LABS_DIR}`);

    const childVal = spawn('sudo', ['-S', 'kathara', 'lstart', '--privileged', '--noterminals'], {
      cwd: LABS_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (sudoPassword) {
      childVal.stdin.write(sudoPassword + '\n');
    }
    childVal.stdin.end();

    let stdoutData = '';
    let stderrData = '';

    childVal.stdout.on('data', (data) => {
      const msg = data.toString();
      stdoutData += msg;
      sendLog('log', msg);
    });

    childVal.stderr.on('data', (data) => {
      const msg = data.toString();
      // Filter out the password prompt itself if strictly needed, but sudo -S usually just reads
      if (!msg.includes('[sudo] password for')) {
        stderrData += msg;
        sendLog('warn', msg);
      }
    });

    childVal.on('close', (code) => {
      if (code === 0) {
        sendLog('log', "✅ Lab started.");
        resolve(stdoutData.trim());
      } else {
        const errorMessage = `❌ Failed to start (code ${code}): ${stderrData}`;
        sendLog('error', errorMessage);
        reject(errorMessage);
      }
    });

    childVal.on('error', (err) => {
      const errorMessage = `❌ Spawn error: ${err.message}`;
      sendLog('error', errorMessage);
      reject(errorMessage);
    });
  });
});



ipcMain.handle('stop-simulation', async () => {
  if (!CURRENT_LAB) {
    throw new Error("Nessuna simulazione attiva in questa sessione.");
  }

  const { name, labsDir, labPath } = CURRENT_LAB;

  const safeName = String(name).replace(/"/g, '\"');
  const cmd = `kathara lclean -d "${labsDir}"`;

  sendLog('log', `🛑 Stopping lab with: ${cmd}`);

  return await new Promise((resolve, reject) => {
    exec(cmd, async (error, stdout, stderr) => {
      if (error) {
        const errorMessage = `❌ lclean failed: ${stderr || error.message}`;
        sendLog('error', errorMessage);
        return reject(errorMessage);
      }
      if (stderr) {
        sendLog('warn', stderr);
      }
      sendLog('log', stdout);
      await emptyKatharaLabs(labsDir);

      sendLog('log', "✅ lclean done.");
      resolve(stdout.trim());
    });
  });
});


// --- Terminal IPC ---

const terminals = new Map<string, IPty>();

ipcMain.handle('terminal.create', async (event, containerName: string) => {
  const shell = 'docker';
  let targetContainer = '';
  try {
    const ancestorName = await (async () => {
      const patterns = [
        CURRENT_LAB ? `kathara_.*_${CURRENT_LAB.name}_${containerName}_` : `_${containerName}_`,
        `_${containerName}_`
      ];
      for (const pattern of patterns) {
        const name = await new Promise<string | null>(r => {
          exec(`docker ps --filter name=${pattern} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
        });
        if (name) return name;
      }
      return await new Promise<string | null>(r => {
        exec(`docker ps --filter ancestor=${containerName} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
      });
    })();

    if (!ancestorName) throw new Error('Container not found');
    targetContainer = ancestorName;
  } catch (e: any) {
    sendLog('error', `Terminal creation failed: ${e}`);
    let verifyError = String(e);
    if (verifyError.includes('permission denied') || verifyError.includes('connect to the docker API')) {
      verifyError = "Docker permission denied. Please add your user to the docker group: sudo usermod -aG docker $USER";
    }
    throw new Error(verifyError);
  }

  const ptyProcess = pty.spawn(shell, ['exec', '-it', targetContainer, '/bin/bash'], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env as any
  });

  const id = Date.now().toString();
  terminals.set(id, ptyProcess);

  ptyProcess.onData((data) => {
    if (mainWindow) {
      mainWindow.webContents.send('terminal.incoming', { id, data });
    }
  });

  ptyProcess.onExit(() => {
    terminals.delete(id);
    if (mainWindow) {
      mainWindow.webContents.send('terminal.incoming', { id, data: '\r\n[Process exited]\r\n' });
    }
  });

  return id;
});

ipcMain.on('terminal.input', (event, { id, data }) => {
  const term = terminals.get(id);
  if (term) {
    term.write(data);
  }
});

ipcMain.on('terminal.resize', (event, { id, cols, rows }) => {
  const term = terminals.get(id);
  if (term) {
    term.resize(cols, rows);
  }
});

ipcMain.handle('terminal.kill', (event, id) => {
  const term = terminals.get(id);
  if (term) {
    term.kill();
    terminals.delete(id);
  }
});


ipcMain.handle('save-scada-project', async (event, machineName) => {
  sendLog('log', `💾 save-scada-project called for: ${machineName}`);

  const patterns = [
    CURRENT_LAB ? `kathara_.*_${CURRENT_LAB.name}_${machineName}_` : `_${machineName}_`,
    `_${machineName}_`
  ];

  const findContainer = async () => {
    for (const pattern of patterns) {
      const name = await new Promise<string | null>(r => {
        exec(`docker ps --filter name=${pattern} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
      });
      if (name) return name;
    }
    return await new Promise<string | null>(r => {
      exec(`docker ps --filter ancestor=${machineName} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
    });
  };

  const containerName = await findContainer();

  if (!containerName) {
    sendLog('warn', `⚠️ Container for ${machineName} not found.`);
    throw new Error("Container not found");
  }

  // Trigger SAVE in FUXA before reading
  const saveCmd = `docker exec ${containerName} curl -s -X POST http://localhost:1881/api/projectData -H "Content-Type: application/json" -d '{"cmd": "save-project"}'`;
  await new Promise(r => exec(saveCmd, r));
  await new Promise(r => setTimeout(r, 500)); // Brief pause for disk write

  return new Promise((resolve, reject) => {
    const filePath = "/usr/src/app/FUXA/server/_appdata/project.fuxap.db";
    const cmd = `docker exec ${containerName} base64 "${filePath}"`;
    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) {
        sendLog('error', `❌ Failed to read project file: ${stderr || error.message}`);
        resolve("");
      } else {
        sendLog('log', `✅ Project file read (${stdout.length} chars)`);
        resolve(stdout.trim());
      }
    });
  });
});

ipcMain.handle('loki-query', async (event, queryParams: string) => {
  try {
    const lokiUrl = `http://127.0.0.1:3100/loki/api/v1/query_range?${queryParams}`;
    const response = await fetch(lokiUrl);
    if (!response.ok) {
      const text = await response.text();
      sendLog('error', `❌ Loki query failed: ${response.status} ${text}`);
      throw new Error(`Loki query failed: ${response.status} ${text}`);
    }
    const data = await response.json();
    return data;
  } catch (err: any) {
    sendLog('error', `❌ Error calling Loki query: ${err.message}`);
    throw err;
  }
});

ipcMain.handle('loki-delete', async (event, { query, start, end }) => {
  sendLog('log', `🗑️ deleteLokiLogs: Deleting logs for query="${query}" start=${start} end=${end}`);
  try {
    const params = new URLSearchParams({
      query,
      start: String(start),
      end: String(end)
    });
    const lokiUrl = `http://127.0.0.1:3100/loki/api/v1/delete?${params.toString()}`;
    const response = await fetch(lokiUrl, { method: 'POST' });
    if (!response.ok) {
      const text = await response.text();
      sendLog('error', `❌ Loki delete failed: ${response.status} ${text}`);
      throw new Error(`Loki delete failed: ${response.status} ${text}`);
    }
    sendLog('log', '✅ Loki logs deleted successfully.');
  } catch (err: any) {
    sendLog('error', `❌ Error calling Loki delete: ${err.message}`);
    throw err;
  }
});




// --- helper per eseguire comandi in modo sicuro (no shell injection) ---
function runCmd(cmd: string, args: string[], opts: { cwd?: string, timeoutMs?: number } = {}) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';
    let timedOut = false;

    const timer = opts.timeoutMs
      ? setTimeout(() => {
        timedOut = true;
        try { child.kill('SIGKILL'); } catch { }
      }, opts.timeoutMs)
      : null;

    child.stdout.on('data', d => (out += d.toString()));
    child.stderr.on('data', d => (err += d.toString()));

    child.on('close', code => {
      if (timer) clearTimeout(timer);
      if (timedOut) return reject(new Error('command timeout'));
      if (code === 0) return resolve(out.trim());
      reject(new Error(err || `exit ${code}`));
    });

    child.on('error', e => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
  });
}



// --- shutdown orchestrato ---
let IS_SHUTTING_DOWN = false;

async function gracefulShutdown() {
  if (IS_SHUTTING_DOWN) return;
  IS_SHUTTING_DOWN = true;

  try {
    // 🔽 qui metti il comando che vuoi eseguire alla chiusura
    // Esempio: pulizia Kathara SE c'è un lab attivo
    if (CURRENT_LAB) {
      console.log('🧹 On-exit: kathara lclean …', CURRENT_LAB.labsDir);
      await runCmd('kathara', ['lclean', '-d', CURRENT_LAB.labsDir], { timeoutMs: 20_000 });
      await emptyKatharaLabs(CURRENT_LAB.labsDir);
    }

    // Oppure, un qualsiasi comando di shell:
    // await runCmd('sh', ['-lc', 'echo "bye" && date'], { timeoutMs: 5000 });

  } catch (e) {
    console.error('❌ On-exit command failed:', e);
  } finally {
    // esci subito senza rientrare in before-quit (eviti loop)
    app.exit(0);
  }
}

// --- intercetta Ctrl+C e terminazioni ---
process.on('SIGINT', () => {
  console.log('📴 Caught SIGINT (Ctrl+C)');
  gracefulShutdown();
});

process.on('SIGTERM', () => {
  console.log('📴 Caught SIGTERM');
  gracefulShutdown();
});

// quando Electron vuole chiudere (click X o sistema)
app.on('before-quit', (event) => {
  // preveniamo l’uscita immediata, facciamo cleanup e poi usciamo noi
  if (!IS_SHUTTING_DOWN) {
    event.preventDefault();
    gracefulShutdown();
  }
});



if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    // STARTUP CLEANUP: Stop any running kathara labs and remove the directory
    const labsDir = path.join(os.homedir(), 'kathara-labs');
    try {
      console.log('🧹 Startup: cleaning previous labs...');
      // 1. Stop simulations
      await runCmd('kathara', ['lclean', '-d', labsDir], { timeoutMs: 20_000 });

      // 2. Remove directory
      await fsp.rm(labsDir, { recursive: true, force: true });
      console.log('✅ Startup: removed labs directory');
    } catch (e) {
      console.error('❌ Startup cleanup failed:', e);
      // We continue anyway, so the app doesn't crash if cleanup fails
    }

    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
    protocol.handle('icr', (request) => {
      const filePath = request.url.slice('icr://'.length)
      return net.fetch(url.pathToFileURL(getAssetPath(filePath)).toString())
    })
  })
  .catch(console.log);
