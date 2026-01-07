
import { Channels } from '../../main/preload';

const API_BASE_URL = 'http://localhost:3001/api';

const isElectron = () => !!(window.electron);

export const api = {
    isElectron: isElectron(),

    async getDockerImages(): Promise<string[]> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('docker-images');
        }
        const response = await fetch(`${API_BASE_URL}/docker-images`);
        return response.json();
    },

    async buildDockerImage(name: string): Promise<string[]> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('docker-build', name);
        }
        const response = await fetch(`${API_BASE_URL}/docker-build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        return response.json();
    },

    async simulateAttack(container: string, command: string | string[]): Promise<string> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('simulate-attack', { container, command });
        }
        const response = await fetch(`${API_BASE_URL}/simulate-attack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ container, command }),
        });
        const data = await response.json();
        return data.output;
    },

    async runSimulation(machines: any[], labInfo: any): Promise<string> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('run-simulation', { machines, labInfo });
        }
        const response = await fetch(`${API_BASE_URL}/run-simulation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ machines, labInfo }),
        });
        const data = await response.json();
        return data.output;
    },

    async stopSimulation(): Promise<string> {
        if (isElectron()) {
            return window.electron.ipcRenderer.invoke('stop-simulation');
        }
        const response = await fetch(`${API_BASE_URL}/stop-simulation`, {
            method: 'POST',
        });
        const data = await response.json();
        return data.output;
    },

    subscribeToLogs(callback: (level: string, message: string) => void): () => void {
        if (isElectron()) {
            return window.electron.ipcRenderer.on('log-message', (arg: any) => {
                const { level, message } = arg as { level: string; message: string };
                callback(level, message);
            });
        } else {
            const eventSource = new EventSource(`${API_BASE_URL}/logs`);
            eventSource.onmessage = (event) => {
                try {
                    const { level, message } = JSON.parse(event.data);
                    callback(level, message);
                } catch (e) {
                    console.error('Failed to parse log message', e);
                }
            };
            return () => {
                eventSource.close();
            };
        }
    }
};
