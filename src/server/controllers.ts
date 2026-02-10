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

    // 1. Find the container by name pattern (Kathara: _machineName_)
    exec(`docker ps --filter name=_${containerName}_ --format "{{.Names}}"`, (findErr, findStdout) => {
        if (findErr) {
            console.error(`Error searching for container ${containerName}: ${findErr.message}`);
            if (findErr.message.includes('permission denied') || findErr.message.includes('connect to the docker API')) {
                return res.status(500).json({ error: "Docker permission denied. Run: sudo usermod -aG docker $USER" });
            }
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
            sendLog('log', `📄 File presenti: ${fs.readdirSync(LAB_PATH)}`);
            exec(`kathara lstart --noterminals`, { cwd: LAB_PATH }, (error, stdout, stderr) => {
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

export const getMachineContent = async (req: Request, res: Response) => {
    const { machineName, type } = req.body;
    if (!machineName) return res.status(400).json({ error: 'Machine name required' });

    sendLog('log', `💾 getMachineContent called for: ${machineName} (${type})`);

    // Try to find container by name pattern (Kathara: _machineName_)
    const nameCmd = `docker ps --filter name=_${machineName}_ --format "{{.Names}}"`;

    exec(nameCmd, (err, stdout) => {
        if (err) {
            sendLog('error', `❌ Error finding container for ${machineName}: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }

        let containerName = stdout ? stdout.trim().split("\n")[0] : null;

        const fetchContent = (targetContainer: string) => {
            let cmd = "";
            if (type === 'scada') {
                const filePath = "/usr/src/app/FUXA/server/_appdata/project.fuxap.db";
                cmd = `docker exec ${targetContainer} base64 "${filePath}"`;
            } else if (type === 'plc') {
                // For PLC, we need to find the ST file in /shared/
                // We'll use a shell command to find the .st file and base64 it
                cmd = `docker exec ${targetContainer} sh -c 'find /shared -name "*.st" -print -quit | xargs base64'`;
            } else {
                return res.status(400).json({ error: "Invalid machine type for content fetching" });
            }

            exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                if (error) {
                    // It's possible the file doesn't exist yet (not started or no program)
                    sendLog('warn', `⚠️ Failed to read content for ${machineName}: ${stderr || error.message}`);
                    return res.json({ output: "" }); // Return empty string instead of erroring out entire save
                } else {
                    // SANITIZE: Remove any non-base64 characters (e.g., shell noise, headers)
                    const cleanOutput = stdout.replace(/[^A-Za-z0-9+/=]/g, '');
                    sendLog('log', `✅ Content read for ${machineName} (${cleanOutput.length} chars)`);
                    res.json({ output: cleanOutput });
                }
            });
        };

        if (!containerName) {
            sendLog('warn', `⚠️ Container for ${machineName} not found by name pattern. Trying ancestor...`);
            exec(`docker ps --filter ancestor=${machineName} --format "{{.Names}}"`, (err2, stdout2) => {
                containerName = stdout2 ? stdout2.trim().split("\n")[0] : null;
                if (containerName) {
                    fetchContent(containerName);
                } else {
                    // Container not running, just return empty content (maybe not started yet)
                    sendLog('warn', `⚠️ Container not found for ${machineName}. Skipping content fetch.`);
                    res.json({ output: "" });
                }
            });
        } else {
            fetchContent(containerName);
        }
    });
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

    // Try to find container by name pattern (Kathara: _machineName_)
    const nameCmd = `docker ps --filter name=_${machineName}_ --format "{{.Names}}"`;

    exec(nameCmd, (err, stdout) => {
        if (err) {
            sendLog('error', `❌ Error finding container for ${machineName}: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }

        let containerName = stdout ? stdout.trim().split("\n")[0] : null;

        const fetchContent = (targetContainer: string) => {
            // Path valid for FUXA
            const filePath = "/usr/src/app/FUXA/server/_appdata/project.fuxap.db";
            const cmd = `docker exec ${targetContainer} base64 "${filePath}"`;

            exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                if (error) {
                    sendLog('warn', `⚠️ Failed to read project db for ${machineName}: ${stderr || error.message}`);
                    return res.status(500).json({ error: "Failed to read project content" });
                } else {
                    // SANITIZE: Remove any non-base64 characters
                    const cleanOutput = stdout.replace(/[^A-Za-z0-9+/=]/g, '');
                    sendLog('log', `✅ Project DB read for ${machineName} (${cleanOutput.length} chars)`);
                    res.json({ output: cleanOutput });
                }
            });
        };

        if (!containerName) {
            sendLog('warn', `⚠️ Container for ${machineName} not found by name pattern. Trying ancestor...`);
            exec(`docker ps --filter ancestor=${machineName} --format "{{.Names}}"`, (err2, stdout2) => {
                containerName = stdout2 ? stdout2.trim().split("\n")[0] : null;
                if (containerName) {
                    fetchContent(containerName);
                } else {
                    sendLog('warn', `⚠️ Container not found for ${machineName}. Cannot save project.`);
                    res.status(404).json({ error: "Container not found" });
                }
            });
        } else {
            fetchContent(containerName);
        }
    });
};
