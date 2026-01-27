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
    exec(`docker compose -f ./containers/docker-compose.yaml build ${name}`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            console.error("Build failed:", stderr);
            res.json([]);
        } else {
            res.json(stdout.split("\n"));
        }
    });
};

export const getContainerInspect = async (req: Request, res: Response) => {
    const { containerName } = req.body;
    if (!containerName) return res.status(400).json({ error: 'Container name required' });

    // 1. Find the container by name pattern (Kathara: _machineName_)
    exec(`docker ps --filter name=_${containerName}_ --format "{{.Names}}"`, (findErr, findStdout) => {
        if (findErr) {
            console.error(`Error searching for container ${containerName}: ${findErr.message}`);
            return res.json([]);
        }

        const resolvedName = findStdout.trim().split("\n")[0];
        if (!resolvedName) {
            // Fallback: exact match
            exec(`docker inspect ${containerName}`, (inspectErr, inspectStdout) => {
                if (inspectErr) {
                    console.warn(`Could not find container for ${containerName}`);
                    res.json([]);
                } else {
                    try { res.json(JSON.parse(inspectStdout)); }
                    catch (e) { res.json([]); }
                }
            });
            return;
        }

        // 2. Inspect the found container
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
    });
};

export const getContainerLogs = async (req: Request, res: Response) => {
    const { containerName } = req.body;
    if (!containerName) return res.status(400).json({ error: 'Container name required' });

    console.log(`🔍 getContainerLogs called for: ${containerName}`);

    // Try to find container using the same logic as terminal and Electron handler
    // 1. First try by ancestor (image name)
    exec(`docker ps --filter ancestor=${containerName} --format "{{.Names}}"`, (err1, stdout1) => {
        const nameByAncestor = stdout1 ? stdout1.trim().split("\n")[0] : null;

        if (nameByAncestor) {
            console.log(`✅ Found by ancestor: ${nameByAncestor}`);
            exec(`docker logs ${nameByAncestor}`, (logsErr, logsStdout) => {
                if (logsErr) {
                    console.error("Docker logs failed:", logsErr.message);
                    res.json({ logs: '' });
                } else {
                    console.log(`✅ Got logs: ${logsStdout.length} chars`);
                    res.json({ logs: logsStdout });
                }
            });
            return;
        }

        // 2. Fallback: try by name pattern (Kathara: _containerName_)
        exec(`docker ps --filter name=_${containerName}_ --format "{{.Names}}"`, (err2, stdout2) => {
            const nameByPattern = stdout2 ? stdout2.trim().split("\n")[0] : null;

            if (nameByPattern) {
                console.log(`✅ Found by pattern: ${nameByPattern}`);
                exec(`docker logs ${nameByPattern}`, (logsErr, logsStdout) => {
                    if (logsErr) {
                        console.error("Docker logs failed:", logsErr.message);
                        res.json({ logs: '' });
                    } else {
                        console.log(`✅ Got logs: ${logsStdout.length} chars`);
                        res.json({ logs: logsStdout });
                    }
                });
                return;
            }

            // 3. Last resort: try exact name
            console.warn(`⚠️ Container not found by ancestor or pattern, trying exact: ${containerName}`);
            exec(`docker logs ${containerName}`, (logsErr, logsStdout) => {
                if (logsErr) {
                    console.error(`❌ Could not get logs: ${logsErr.message}`);
                    res.json({ logs: '' });
                } else {
                    console.log(`✅ Got logs (exact): ${logsStdout.length} chars`);
                    res.json({ logs: logsStdout });
                }
            });
        });
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
            args = command.flatMap((el) => String(el).split(/[,\s]+/).filter(Boolean));
        } else if (typeof command === 'string') {
            args = command.trim().split(/[,\s]+/).filter(Boolean);
        } else {
            throw new Error('Invalid command type');
        }

        args = args.map(a => a.replace(/^["']|["']$/g, '').trim()).filter(Boolean);
        const seen = new Set<string>();
        args = args.filter(x => (seen.has(x) ? false : (seen.add(x), true)));

        if (args.length === 0) {
            throw new Error('No valid command arguments after normalization.');
        }
        sendLog('log', `Normalized args for docker exec: ${args}`);
    } catch (err: any) {
        sendLog('error', `❌ Failed to normalize command: ${err}`);
        return res.status(400).json({ error: err.message });
    }

    try {
        const containerName = await new Promise<string>((resolve, reject) => {
            // First try finding by ancestor (image)
            exec(`docker ps --filter ancestor=${container} --format "{{.Names}}"`, (err, stdout, stderr) => {
                const nameByAncestor = stdout ? stdout.trim().split("\n")[0] : null;

                if (nameByAncestor) {
                    sendLog('log', `✅ Using container (by image): ${nameByAncestor}`);
                    return resolve(nameByAncestor);
                }

                // Fallback: try finding by name (matches *container*)
                // Kathara containers are typically: kathara_<user>_<labhash>_<machinename>_<uid>
                // So checking if name contains `_${container}_` covers it.
                exec(`docker ps --filter name=_${container}_ --format "{{.Names}}"`, (err2, stdout2, stderr2) => {
                    if (err2) {
                        const msg = `❌ Error looking for container: ${stderr2 || err2.message}`;
                        sendLog('error', msg);
                        return reject(msg);
                    }
                    const nameByName = stdout2.trim().split("\n")[0];
                    if (!nameByName) {
                        const msg = `⚠️ No running container found for image/name: ${container}`;
                        sendLog('warn', msg);
                        return reject(msg);
                    }
                    sendLog('log', `✅ Using container (by name): ${nameByName}`);
                    resolve(nameByName);
                });
            });
        });

        const output = await new Promise<string>((resolve, reject) => {
            const dockerArgs = ['exec', containerName, ...args];
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

        res.json({ output });
    } catch (error: any) {
        res.status(500).json({ error: error.toString() });
    }
};

export const runSimulation = async (req: Request, res: Response) => {
    const { machines, labInfo } = req.body;
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
            sendLog('log', `📂 Lanciando kathara in: ${LAB_PATH}`);
            sendLog('log', `📄 File presenti: ${fs.readdirSync(LABS_DIR)}`);
            exec(`kathara lstart --noterminals`, { cwd: LABS_DIR }, (error, stdout, stderr) => {
                if (error) {
                    const errorMessage = `❌ Failed to start: ${stderr || error.message}`;
                    sendLog('error', errorMessage);
                    return reject(errorMessage);
                }
                if (stderr) {
                    sendLog('warn', stderr);
                }
                sendLog('log', stdout);
                sendLog('log', "✅ Lab started.");
                resolve(stdout.trim());
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
        sendLog('log', `🧹 Contenuto rimosso da: ${labsDir}`);
    } catch (err) {
        sendLog('error', `❌ Errore durante lo svuotamento: ${err}`);
    }
}

export const stopSimulation = async (req: Request, res: Response) => {
    if (!CURRENT_LAB) {
        return res.status(400).json({ error: "Nessuna simulazione attiva." });
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

export const saveScadaProject = async (req: Request, res: Response) => {
    const { machineName } = req.body;
    if (!machineName) return res.status(400).json({ error: 'Machine name required' });

    sendLog('log', `💾 saveScadaProject called for: ${machineName}`);

    // Try to find container by name pattern (Kathara: _machineName_)
    const nameCmd = `docker ps --filter name=_${machineName}_ --format "{{.Names}}"`;

    exec(nameCmd, (err, stdout) => {
        if (err) {
            sendLog('error', `❌ Error finding container for ${machineName}: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }

        let containerName = stdout ? stdout.trim().split("\n")[0] : null;

        const runBase64 = (targetContainer: string) => {
            const filePath = "/usr/src/app/FUXA/server/_appdata/project.fuxap.db";
            // Use base64 to safeguard binary data
            const cmd = `docker exec ${targetContainer} base64 "${filePath}"`;
            exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                if (error) {
                    sendLog('error', `❌ Failed to read project file: ${stderr || error.message}`);
                    return res.status(500).json({ error: stderr || error.message });
                } else {
                    sendLog('log', `✅ Project file read (${stdout.length} chars)`);
                    res.json({ output: stdout.trim() });
                }
            });
        };

        if (!containerName) {
            sendLog('warn', `⚠️ Container for ${machineName} not found by name pattern. Trying ancestor...`);
            exec(`docker ps --filter ancestor=${machineName} --format "{{.Names}}"`, (err2, stdout2) => {
                containerName = stdout2 ? stdout2.trim().split("\n")[0] : null;
                if (containerName) {
                    runBase64(containerName);
                } else {
                    res.status(404).json({ error: "Container not found" });
                }
            });
        } else {
            runBase64(containerName);
        }
    });
};

// --- Save System Controllers ---

export const listSaves = async (req: Request, res: Response) => {
    try {
        const files = await fsp.readdir(SAVES_DIR);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        res.json(jsonFiles);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const saveProject = async (req: Request, res: Response) => {
    const { filename, data } = req.body;
    if (!filename || !data) {
        return res.status(400).json({ error: 'Filename and data are required' });
    }

    // specific sanitize for filename to avoid directory traversal
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const filePath = path.join(SAVES_DIR, safeFilename.endsWith('.json') ? safeFilename : `${safeFilename}.json`);

    try {
        await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
        sendLog('log', `💾 Project saved: ${safeFilename}`);
        res.json({ success: true, filename: safeFilename });
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

    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const filePath = path.join(SAVES_DIR, safeFilename);

    try {
        const content = await fsp.readFile(filePath, 'utf-8');
        sendLog('log', `📂 Project loaded: ${safeFilename}`);
        res.json(JSON.parse(content));
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

    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const filePath = path.join(SAVES_DIR, safeFilename);

    try {
        await fsp.unlink(filePath);
        sendLog('log', `🗑️ Project deleted: ${safeFilename}`);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};


