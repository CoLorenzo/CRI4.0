import { Request, Response } from 'express';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';
import { generateZipNode } from '../shared/make-node';

// Type definitions
type CurrentLab = {
    name: string;
    labsDir: string;
    labPath: string;
    zipPath: string;
};

let CURRENT_LAB: CurrentLab | null = null;
let clients: Response[] = [];

// Ensure saves directory exists
const SAVES_DIR = path.join(process.cwd(), 'saves');
if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
}

let LAST_ATTACK_OUTPUT = "";
let IS_ATTACK_RUNNING = false;


// Helper to send logs to all connected clients
const sendLog = (level: 'log' | 'error' | 'warn' | 'info' | 'debug', message: string) => {
    const logEntry = JSON.stringify({ level, message });
    clients.forEach(client => client.write(`data: ${logEntry}\n\n`));
    console.log(`[${level.toUpperCase()}] ${message}`); // Keep server console logs too
};

// --- Controllers ---

export const subscribeToLogs = (req: Request, res: Response) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    };
    res.writeHead(200, headers);

    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
};

export const getDockerImages = async (req: Request, res: Response) => {
    exec('docker images --format "{{.Repository}}" | grep "^icr/"', (error, stdout, stderr) => {
        if (error) {
            res.json([]);
        } else {
            res.json(stdout.trim().split("\n"));
        }
    });
};

export const buildDockerImage = async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Image name required' });

    console.log("BUILDING:", name);
    sendLog('log', `🚀 Starting build for ${name}...`);

    // Respond immediately to prevent browser timeout
    res.json(["Build started in background. Check logs for progress."]);

    const dockerArgs = ['compose', '-f', './containers/docker-compose.yaml', 'build', name];

    try {
        const proc = spawn('docker', dockerArgs);

        proc.stdout.on('data', (data) => {
            sendLog('log', data.toString().trim());
        });

        proc.stderr.on('data', (data) => {
            // Docker build output often goes to stderr
            sendLog('log', data.toString().trim());
        });

        proc.on('close', (code) => {
            if (code === 0) {
                sendLog('log', `✅ Build successful: ${name}`);
            } else {
                sendLog('error', `❌ Build failed: ${name} (code ${code})`);
            }
        });

        proc.on('error', (err) => {
            sendLog('error', `❌ Spawn error: ${err.message}`);
        });

    } catch (e: any) {
        sendLog('error', `❌ Build error: ${e.message}`);
    }
};

export const getContainerInspect = async (req: Request, res: Response) => {
    const { containerName } = req.body;
    if (!containerName) return res.status(400).json({ error: 'Container name required' });

    // Improved resolution
    const patterns = [
        CURRENT_LAB ? `kathara_.*_${CURRENT_LAB.name}_${containerName}_` : `_${containerName}_`,
        `_${containerName}_`
    ];

    const findContainer = async () => {
        for (const pattern of patterns) {
            const name = await new Promise<string | null>(r => {
                exec(`docker ps --filter name=${pattern} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
            });
            if (name) return name;
        }
        return await new Promise<string | null>(r => {
            exec(`docker ps --filter ancestor=${containerName} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
        });
    };

    const resolvedName = await findContainer();

    if (!resolvedName) {
        console.warn(`Could not find container for ${containerName}`);
        return res.json([]);
    }

    exec(`docker inspect ${resolvedName}`, (inspectErr, inspectStdout) => {
        if (inspectErr) {
            console.error("Inspect failed:", inspectErr.message);
            res.json([]);
        } else {
            try {
                res.json(JSON.parse(inspectStdout));
            } catch (e) {
                console.error("JSON parse error:", e);
                res.json([]);
            }
        }
    });
};

export const getContainerLogs = async (req: Request, res: Response) => {
    const { containerName } = req.body;
    if (!containerName) return res.status(400).json({ error: 'Container name required' });

    console.log(`🔍 getContainerLogs called for: ${containerName}`);

    const patterns = [
        CURRENT_LAB ? `kathara_.*_${CURRENT_LAB.name}_${containerName}_` : `_${containerName}_`,
        `_${containerName}_`
    ];

    const findContainer = async () => {
        for (const pattern of patterns) {
            const name = await new Promise<string | null>(r => {
                exec(`docker ps --filter name=${pattern} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
            });
            if (name) return name;
        }
        return await new Promise<string | null>(r => {
            exec(`docker ps --filter ancestor=${containerName} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
        });
    };

    const resolvedName = await findContainer();

    if (!resolvedName) {
        sendLog('warn', `⚠️ Container not found for ${containerName}. Cannot get logs.`);
        return res.json({ logs: '' });
    }

    exec(`docker logs ${resolvedName}`, (logsErr, logsStdout) => {
        if (logsErr) {
            console.error(`❌ Could not get logs: ${logsErr.message}`);
            res.json({ logs: '' });
        } else {
            console.log(`✅ Got logs: ${logsStdout.length} chars`);
            res.json({ logs: logsStdout });
        }
    });
};

export const simulateAttack = async (req: Request, res: Response) => {
    const { container, command } = req.body;
    const timestamp = new Date().toLocaleString();

    sendLog('log', `[${timestamp}] simulate-attack request`);
    sendLog('log', `Image name received: ${container}`);
    sendLog('log', `Raw command payload: ${command}`);

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
        return res.status(400).json({ error: err.message });
    }

    try {
        const resolvedName = await (async () => {
            const patterns = [
                CURRENT_LAB ? `kathara_.*_${CURRENT_LAB.name}_${container}_` : `_${container}_`,
                `_${container}_`
            ];
            for (const pattern of patterns) {
                const name = await new Promise<string | null>(r => {
                    exec(`docker ps --filter name=${pattern} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
                });
                if (name) {
                    sendLog('log', `✅ Found container by name (${pattern}): ${name}`);
                    return name;
                }
            }
            return await new Promise<string | null>(r => {
                exec(`docker ps --filter ancestor=${container} --format "{{.Names}}"`, (e, s) => {
                    const name = s ? s.trim().split("\n")[0] : null;
                    if (name) sendLog('log', `✅ Found container by ancestor: ${name}`);
                    r(name);
                });
            });
        })();

        if (!resolvedName) {
            const msg = `⚠️ No running container found for image/name: ${container}`;
            sendLog('warn', msg);
            throw new Error(msg);
        }

        const output = await new Promise<string>((resolve, reject) => {
            const dockerArgs = ['exec', resolvedName, ...args];
            sendLog('log', `Spawning process: docker ${dockerArgs.join(' ')}`);

            const proc = spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                const message = data.toString();
                stdout += message;
                LAST_ATTACK_OUTPUT += message;
                // Keep only last 10000 chars roughly
                if (LAST_ATTACK_OUTPUT.length > 50000) LAST_ATTACK_OUTPUT = LAST_ATTACK_OUTPUT.slice(-50000);
                sendLog('log', message);
            });

            proc.stderr.on('data', (data) => {
                const message = data.toString();
                stderr += message;
                LAST_ATTACK_OUTPUT += `\n[ERROR] ${message}`;
                sendLog('error', message);
            });

            IS_ATTACK_RUNNING = true;
            proc.on('close', (code) => {
                IS_ATTACK_RUNNING = false;
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

        res.json({ output });
    } catch (error: any) {
        res.status(500).json({ error: error.toString() });
    }
};

export const getAttackStatus = async (req: Request, res: Response) => {
    res.json({ 
        isRunning: IS_ATTACK_RUNNING,
        output: LAST_ATTACK_OUTPUT 
    });
};

export const clearAttackStatus = async (req: Request, res: Response) => {
    LAST_ATTACK_OUTPUT = "";
    res.json({ success: true });
};


export const runSimulation = async (req: Request, res: Response) => {
    const { machines, labInfo, sudoPassword } = req.body;
    sendLog('log', `machines? ${Array.isArray(machines)} ${machines?.length}`);

    // DEBUG: Check for SCADA payload
    if (Array.isArray(machines)) {
        machines.forEach(m => {
            if (m.type === 'scada') {
                sendLog('log', `[SERVER] SCADA Machine found: ${m.name}`);
                sendLog('log', `[SERVER] Industrial prop: ${!!m.industrial}`);
                if (m.industrial) {
                    sendLog('log', `[SERVER] scadaProjectName: ${m.industrial.scadaProjectName}`);
                    sendLog('log', `[SERVER] scadaProjectContent length: ${m.industrial.scadaProjectContent?.length}`);
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

    try {
        sendLog('log', "📦 Generating ZIP...");
        await generateZipNode(machines, labInfo, ZIP_PATH);

        sendLog('log', "📂 Extracting ZIP...");
        const zip = new AdmZip(ZIP_PATH);
        zip.extractAllTo(LABS_DIR, true);

        CURRENT_LAB = { name: LAB_NAME, labsDir: LABS_DIR, labPath: LAB_PATH, zipPath: ZIP_PATH };

        sendLog('log', "🚀 Launching Kathara...");
        const output = await new Promise((resolve, reject) => {
            sendLog('log', `📂 Launching kathara in: ${LABS_DIR}`);
            sendLog('log', `📄 Files present: ${fs.readdirSync(LABS_DIR)}`);

            // If a sudo password is provided, run privileged (needed for MITM/injection).
            // Otherwise run kathara directly so plain labs (ubuntu, archlinux, custom images)
            // don't require root and don't fail with a bad/empty password.
            let spawnCmd: string;
            let spawnArgs: string[];
            if (sudoPassword) {
                spawnCmd = 'sudo';
                spawnArgs = ['-S', 'kathara', 'lstart', '--privileged', '--noterminals'];
            } else {
                spawnCmd = 'kathara';
                spawnArgs = ['lstart', '--noterminals'];
            }

            sendLog('log', `▶️ Running: ${spawnCmd} ${spawnArgs.join(' ')}`);

            const childVal = spawn(spawnCmd, spawnArgs, {
                cwd: LABS_DIR,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Write password to stdin only when using sudo
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
                // Filter out standard sudo prompt if it leaks, though -S implies non-interactive
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
                    // Kathara writes most output to stdout, not stderr — include both
                    const combined = [stdoutData, stderrData].filter(Boolean).join('\n').trim();
                    const errorMessage = `❌ Failed to start (code ${code}): ${combined}`;
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
        res.json({ output });

    } catch (err: any) {
        res.status(500).json({ error: err.toString() });
    }
};

async function emptyKatharaLabs(labsDir: string) {
    try {
        const entries = await fsp.readdir(labsDir);
        await Promise.allSettled(
            entries.map((entry) =>
                fsp.rm(path.join(labsDir, entry), { recursive: true, force: true })
            )
        );
        sendLog('log', `🧹 Content removed from: ${labsDir}`);
    } catch (err) {
        sendLog('error', `❌ Error during emptying: ${err}`);
    }
}

export const stopSimulation = async (req: Request, res: Response) => {
    if (!CURRENT_LAB) {
        return res.status(400).json({ error: "No active simulation." });
    }

    const { name, labsDir } = CURRENT_LAB;
    const safeName = String(name).replace(/"/g, '\"');
    const cmd = `kathara lclean -d "${labsDir}"`;

    sendLog('log', `🛑 Stopping lab with: ${cmd}`);

    try {
        const output = await new Promise((resolve, reject) => {
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
        res.json({ output });
    } catch (err: any) {
        res.status(500).json({ error: err.toString() });
    }
};

export const getMachineContent = async (req: Request, res: Response) => {
    const { machineName, type } = req.body;
    if (!machineName) return res.status(400).json({ error: 'Machine name required' });

    sendLog('log', `💾 getMachineContent called for: ${machineName} (${type})`);

    // Try to find container: prefer CURRENT_LAB name pattern, then generic, then ancestor
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
        // Last resort: ancestor
        return await new Promise<string | null>(r => {
            exec(`docker ps --filter ancestor=${machineName} --format "{{.Names}}"`, (e, s) => r(s ? s.trim().split("\n")[0] : null));
        });
    };

    const containerName = await findContainer();

    if (!containerName) {
        sendLog('warn', `⚠️ Container not found for ${machineName}. Skipping content fetch.`);
        return res.json({ output: "" });
    }

    const fetchContent = async (targetContainer: string) => {
        let cmd = "";
        if (type === 'scada') {
            // Trigger SAVE in FUXA before reading
            const saveCmd = `docker exec ${targetContainer} curl -s -X POST http://localhost:1881/api/projectData -H "Content-Type: application/json" -d '{"cmd": "save-project"}'`;
            await new Promise(r => exec(saveCmd, r));
            await new Promise(r => setTimeout(r, 500)); // Brief pause for disk write

            const filePath = "/usr/src/app/FUXA/server/_appdata/project.fuxap.db";
            cmd = `docker exec ${targetContainer} base64 "${filePath}"`;
        } else if (type === 'plc') {
            cmd = `docker exec ${targetContainer} sh -c 'find /shared -name "*.st" -print -quit | xargs base64'`;
        } else {
            return res.status(400).json({ error: "Invalid machine type for content fetching" });
        }

        exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
                sendLog('warn', `⚠️ Failed to read content for ${machineName}: ${stderr || error.message}`);
                return res.json({ output: "" });
            } else {
                const cleanOutput = stdout.replace(/[^A-Za-z0-9+/=]/g, '');
                sendLog('log', `✅ Content read for ${machineName} (${cleanOutput.length} chars)`);
                res.json({ output: cleanOutput });
            }
        });
    };

    fetchContent(containerName);
};

// --- Save System Controllers ---

export const listSaves = async (req: Request, res: Response) => {
    try {
        const entries = await fsp.readdir(SAVES_DIR, { withFileTypes: true });
        const projectFolders: string[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const projectPath = path.join(SAVES_DIR, entry.name, 'project.json');
                if (fs.existsSync(projectPath)) {
                    projectFolders.push(entry.name);
                }
            } else if (entry.isFile() && entry.name.endsWith('.cri')) {
                // Return filename without extension for UI consistency
                projectFolders.push(entry.name.replace('.cri', ''));
            }
        }
        res.json(projectFolders);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const saveProject = async (req: Request, res: Response) => {
    const { filename, data } = req.body;
    if (!filename || !data) {
        return res.status(400).json({ error: 'Filename and data are required' });
    }

    // specific sanitize for filename
    const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const criPath = path.join(SAVES_DIR, `${safeName}.cri`);

    try {
        const zip = new AdmZip();

        // Process machines to extract binary content
        if (data.machines && Array.isArray(data.machines)) {
            for (const m of data.machines) {
                if (m.industrial) {
                    // Handle SCADA content
                    if (m.type === 'scada' && m.industrial.scadaProjectContent) {
                        const content = m.industrial.scadaProjectContent;
                        // Strip Data URI prefix if present (e.g. data:application/octet-stream;base64,...)
                        const rawContent = content.includes(';base64,') ? content.split(';base64,').pop() : content;
                        const buffer = Buffer.from(rawContent, 'base64');

                        const dbFilename = `${m.name}.db`;
                        zip.addFile(dbFilename, buffer);
                        m.industrial.scadaProjectContent = `file:${dbFilename}`;
                    }
                    // Handle PLC content
                    if (m.type === 'plc' && m.industrial.plcProgramContent) {
                        const content = m.industrial.plcProgramContent;
                        // Strip Data URI prefix if present
                        const rawContent = content.includes(';base64,') ? content.split(';base64,').pop() : content;
                        const buffer = Buffer.from(rawContent, 'base64');

                        const stFilename = `${m.name}.st`;
                        zip.addFile(stFilename, buffer);
                        m.industrial.plcProgramContent = `file:${stFilename}`;
                    }
                }
            }
        }

        const projectJsonContent = JSON.stringify(data, null, 2);
        zip.addFile('project.json', Buffer.from(projectJsonContent, 'utf-8'));

        // Write the zip file
        zip.writeZip(criPath);

        sendLog('log', `💾 Project saved to compressed file: ${safeName}.cri`);
        res.json({ success: true, filename: safeName });
    } catch (err: any) {
        sendLog('error', `❌ Error saving project: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

export const loadProject = async (req: Request, res: Response) => {
    const { filename } = req.params;
    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const criPath = path.join(SAVES_DIR, `${safeName}.cri`);
    // Legacy support
    const legacyProjectDir = path.join(SAVES_DIR, safeName);
    const legacyProjectJsonPath = path.join(legacyProjectDir, 'project.json');

    try {
        let data: any = null;
        let getFileContent: (name: string) => Promise<string | null> = async () => null;

        if (fs.existsSync(criPath)) {
            // Load from .cri zip
            const zip = new AdmZip(criPath);
            const projectEntry = zip.getEntry('project.json');

            if (!projectEntry) {
                throw new Error('Invalid .cri file: project.json not found');
            }

            const content = zip.readAsText(projectEntry);
            data = JSON.parse(content);

            getFileContent = async (name: string) => {
                const entry = zip.getEntry(name);
                if (entry) {
                    const buff = zip.readFile(entry);
                    return buff ? buff.toString('base64') : null;
                }
                return null;
            };

            sendLog('log', `📂 Project loaded from compressed file: ${safeName}.cri`);

        } else if (fs.existsSync(legacyProjectJsonPath)) {
            // Load from legacy folder
            const content = await fsp.readFile(legacyProjectJsonPath, 'utf-8');
            data = JSON.parse(content);

            getFileContent = async (name: string) => {
                const filePath = path.join(legacyProjectDir, name);
                if (fs.existsSync(filePath)) {
                    return await fsp.readFile(filePath, 'base64');
                }
                return null;
            };

            sendLog('log', `📂 Project loaded from legacy folder: ${safeName}`);
        } else {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Reassemble binary content
        if (data.machines && Array.isArray(data.machines)) {
            for (const m of data.machines) {
                if (m.industrial) {
                    // Load SCADA content
                    if (m.type === 'scada' && m.industrial.scadaProjectContent && m.industrial.scadaProjectContent.startsWith('file:')) {
                        const dbFilename = m.industrial.scadaProjectContent.substring(5);
                        const dbContent = await getFileContent(dbFilename);
                        if (dbContent) {
                            m.industrial.scadaProjectContent = dbContent;
                        }
                    }
                    // Load PLC content
                    if (m.type === 'plc' && m.industrial.plcProgramContent && m.industrial.plcProgramContent.startsWith('file:')) {
                        const stFilename = m.industrial.plcProgramContent.substring(5);
                        const stContent = await getFileContent(stFilename);
                        if (stContent) {
                            m.industrial.plcProgramContent = stContent;
                        }
                    }
                }
            }
        }

        res.json(data);
    } catch (err: any) {
        sendLog('error', `❌ Error loading project: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

export const deleteProject = async (req: Request, res: Response) => {
    const { filename } = req.params;
    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const criPath = path.join(SAVES_DIR, `${safeName}.cri`);
    const legacyProjectDir = path.join(SAVES_DIR, safeName);

    try {
        if (fs.existsSync(criPath)) {
            await fsp.unlink(criPath);
            sendLog('log', `🗑️ Project file deleted: ${safeName}.cri`);
        } else if (fs.existsSync(legacyProjectDir)) {
            await fsp.rm(legacyProjectDir, { recursive: true, force: true });
            sendLog('log', `🗑️ Legacy project folder deleted: ${safeName}`);
        } else {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};



export const downloadProject = async (req: Request, res: Response) => {
    const { filename } = req.params;
    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const criPath = path.join(SAVES_DIR, `${safeName}.cri`);

    if (fs.existsSync(criPath)) {
        res.download(criPath, `${safeName}.cri`, (err) => {
            if (err) {
                sendLog('error', `❌ Error downloading file: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Failed to download file" });
                }
            } else {
                sendLog('log', `⬇️ Project downloaded: ${safeName}.cri`);
            }
        });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
};


export const uploadProject = async (req: Request, res: Response) => {
    const { filename, content } = req.body;
    if (!filename || !content) {
        return res.status(400).json({ error: 'Filename and content are required' });
    }

    // Sanitize filename
    const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    let targetFilename = safeName;
    if (!targetFilename.endsWith('.cri')) {
        targetFilename += '.cri';
    }

    const criPath = path.join(SAVES_DIR, targetFilename);

    try {
        // Content is expected to be base64 string
        // If it comes with data URI prefix (e.g., "data:application/zip;base64,..."), strip it
        const rawContent = content.includes(';base64,') ? content.split(';base64,').pop() : content;
        const buffer = Buffer.from(rawContent, 'base64');

        await fsp.writeFile(criPath, buffer as any);
        sendLog('log', `⬆️ Project uploaded: ${targetFilename}`);
        res.json({ success: true, filename: targetFilename });
    } catch (err: any) {
        sendLog('error', `❌ Error uploading file: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

export const saveScadaProject = async (req: Request, res: Response) => {
    const { machineName } = req.body;
    if (!machineName) return res.status(400).json({ error: 'Machine name required' });

    sendLog('log', `💾 saveScadaProject called for: ${machineName}`);

    // Try to find container: prefer CURRENT_LAB name pattern, then generic, then ancestor
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
        sendLog('warn', `⚠️ Container not found for ${machineName}. Cannot save project.`);
        return res.status(404).json({ error: "Container not found" });
    }

    const fetchContent = async (targetContainer: string) => {
        // Trigger SAVE in FUXA before reading
        const saveCmd = `docker exec ${targetContainer} curl -s -X POST http://localhost:1881/api/projectData -H "Content-Type: application/json" -d '{"cmd": "save-project"}'`;
        await new Promise(r => exec(saveCmd, r));
        await new Promise(r => setTimeout(r, 500)); // Brief pause for disk write

        const filePath = "/usr/src/app/FUXA/server/_appdata/project.fuxap.db";
        const cmd = `docker exec ${targetContainer} base64 "${filePath}"`;

        exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
                sendLog('warn', `⚠️ Failed to read project db for ${machineName}: ${stderr || error.message}`);
                return res.status(500).json({ error: "Failed to read project content" });
            } else {
                const cleanOutput = stdout.replace(/[^A-Za-z0-9+/=]/g, '');
                sendLog('log', `✅ Project DB read for ${machineName} (${cleanOutput.length} chars)`);
                res.json({ output: cleanOutput });
            }
        });
    };

    fetchContent(containerName);
};

export const deleteLokiLogs = async (req: Request, res: Response) => {
    const { query, start, end } = req.body;

    if (!query || !start || !end) {
        return res.status(400).json({ error: 'Missing required parameters: query, start, end' });
    }

    sendLog('log', `🗑️ deleteLokiLogs: Deleting logs for query="${query}" start=${start} end=${end}`);

    try {
        const params = new URLSearchParams({
            query,
            start: String(start),
            end: String(end)
        });

        // Assuming Loki is running on localhost:3100
        const lokiUrl = `http://127.0.0.1:3100/loki/api/v1/delete?${params.toString()}`;

        const response = await fetch(lokiUrl, {
            method: 'POST'
        });

        if (!response.ok) {
            const text = await response.text();
            sendLog('error', `❌ Loki delete failed: ${response.status} ${text}`);
            return res.status(response.status).send(text);
        }

        sendLog('log', '✅ Loki logs deleted successfully.');
        res.status(204).send();
    } catch (err: any) {
        sendLog('error', `❌ Error calling Loki delete: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

export const queryLokiLogs = async (req: Request, res: Response) => {
    try {
        const params = new URLSearchParams(req.query as Record<string, string>);
        const lokiUrl = `http://127.0.0.1:3100/loki/api/v1/query_range?${params.toString()}`;

        const response = await fetch(lokiUrl);
        if (!response.ok) {
            const text = await response.text();
            sendLog('error', `❌ Loki query failed: ${response.status} ${text}`);
            return res.status(response.status).send(text);
        }

        const data = await response.json();
        res.json(data);
    } catch (err: any) {
        sendLog('error', `❌ Error calling Loki query: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

// --- Save System Controllers ---
