import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { router } from './routes';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
});

// Serve static files from the React app (if built) or just API for now
// In development, we'll run this alongside the webpack dev server.
// In production web mode, we might want to serve static files too.

app.use('/api', router);

// Serve static assets if needed, similar to how Electron does it
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
server.setTimeout(300000); // 5 minutes timeout for long docker builds

import { Server } from 'socket.io';
import * as pty from 'node-pty';
import { IPty } from 'node-pty';
import { exec } from 'child_process';

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const terminals = new Map<string, IPty>();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('terminal.create', async (containerNameInput, callback) => {
        const shell = 'docker';
        let targetContainer = '';

        // Strip "machine-" prefix coming from frontend graph ID
        let containerName = containerNameInput;
        if (containerName.startsWith('machine-')) {
            containerName = containerName.substring(8);
        }

        console.log(`terminal.create request for: "${containerNameInput}" -> "${containerName}"`);
        try {
            const ancestorName = await new Promise<string>((resolve, reject) => {
                const cmd1 = `docker ps --filter ancestor=${containerName} --format "{{.Names}}"`;
                console.log(`Running: ${cmd1}`);
                exec(cmd1, (err, stdout) => {
                    const name = stdout ? stdout.trim().split("\n")[0] : null;
                    if (name) {
                        console.log(`Found via ancestor: ${name}`);
                        resolve(name);
                    } else {
                        const cmd2 = `docker ps --filter name=_${containerName}_ --format "{{.Names}}"`;
                        console.log(`Running: ${cmd2}`);
                        exec(cmd2, (err2, stdout2) => {
                            const name2 = stdout2 ? stdout2.trim().split("\n")[0] : null;
                            if (name2) {
                                console.log(`Found via name: ${name2}`);
                                resolve(name2);
                            } else {
                                console.log(`Failed to find container. containerName="${containerName}"`);
                                reject('Container not found');
                            }
                        });
                    }
                });
            });
            targetContainer = ancestorName;
        } catch (e) {
            console.error(`Terminal creation failed: ${e}`);
            if (typeof callback === 'function') callback({ error: String(e) });
            return;
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
            socket.emit('terminal.incoming', { id, data });
        });

        ptyProcess.onExit(() => {
            terminals.delete(id);
            socket.emit('terminal.incoming', { id, data: '\r\n[Process exited]\r\n' });
        });

        if (typeof callback === 'function') callback({ id });
    });

    socket.on('terminal.input', ({ id, data }) => {
        const term = terminals.get(id);
        if (term) {
            term.write(data);
        }
    });

    socket.on('terminal.resize', ({ id, cols, rows }) => {
        const term = terminals.get(id);
        if (term) {
            term.resize(cols, rows);
        }
    });

    socket.on('terminal.kill', (id) => {
        const term = terminals.get(id);
        if (term) {
            term.kill();
            terminals.delete(id);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Optionally kill terminals related to this socket if we tracked ownership
    });
});
