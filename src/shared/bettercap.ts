/* eslint-disable prettier/prettier */
/**
 * Shared bettercap controller.
 *
 * A single host-side bettercap instance is kept alive for the whole duration of
 * a simulation. It sniffs the Docker bridge (`docker0`), where every Kathara
 * machine has its management interface (172.17.0.x), and exposes bettercap's own
 * web UI (no authentication) so it can be embedded in the "Analyse Traffic"
 * modal.
 *
 * NOTE (Kathara katharanp_vde limitation): the lab collision-domain links
 * (e.g. 10.x) live inside userspace VDE switches and are NOT visible on any host
 * interface, so this host-side capture only sees each machine's management/NAT
 * traffic on docker0 — not inter-machine lab traffic.
 *
 * Per-machine "filtering" is done by pushing a BPF filter (`host <ip>`) into the
 * running bettercap via its REST API whenever a machine's modal is opened, and
 * resetting it to "capture everything" when the modal is closed.
 */
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';

// The Docker default bridge: every Kathara container is attached to it with a
// management interface (172.17.0.x), so it is the single host interface that
// sees all machines at once.
export const BETTERCAP_IFACE = 'docker0';
// bettercap uses TWO separate servers:
//  - the REST API (JSON + websocket) on api.rest.port,
//  - the embedded Angular web UI, served by `ui on` on its own default port.
export const BETTERCAP_API_PORT = 8081;
export const BETTERCAP_UI_PORT = 8080;
// Host/loopback address the renderer uses to reach the web UI.
export const BETTERCAP_HOST = '127.0.0.1';

type Logger = (level: 'log' | 'error' | 'warn' | 'info' | 'debug', message: string) => void;

let bettercapProc: ChildProcess | null = null;
// Retained for the duration of the simulation so we can stop the root-owned
// bettercap process when the simulation is torn down.
let sudoPassword: string | null = null;

const capletPath = path.join(os.tmpdir(), 'cri40-bettercap.cap');

function capletContent(): string {
	// Mirrors the documented bettercap workflow: no auth, web UI on, continuous
	// sniffing with an (initially) empty BPF filter so ALL machines are recorded.
	return [
		'set api.rest.address 0.0.0.0',
		`set api.rest.port ${BETTERCAP_API_PORT}`,
		'set api.rest.username ""',
		'set api.rest.password ""',
		'set ui.address 0.0.0.0',
		'set net.sniff.verbose true',
		'set net.sniff.filter ""',
		'net.sniff on',
		'api.rest on',
		'ui on',
		'',
	].join('\n');
}

export function isBettercapRunning(): boolean {
	return bettercapProc !== null;
}

/**
 * Start the always-on host bettercap. Requires root (pcap), so a sudo password
 * must be supplied; without it we skip silently (the simulation still runs).
 */
export function startBettercap(sudoPw: string | undefined, log: Logger): void {
	if (bettercapProc) {
		log('log', '🦈 bettercap already running, skipping start.');
		return;
	}
	if (!sudoPw) {
		log('warn', '🦈 No sudo password provided — skipping bettercap (traffic analysis unavailable).');
		return;
	}

	try {
		fs.writeFileSync(capletPath, capletContent());
	} catch (e: any) {
		log('error', `🦈 Failed to write bettercap caplet: ${e.message}`);
		return;
	}

	sudoPassword = sudoPw;
	log('log', `🦈 Starting bettercap on ${BETTERCAP_IFACE} (web UI on :${BETTERCAP_UI_PORT}, API on :${BETTERCAP_API_PORT})...`);

	const proc = spawn(
		'sudo',
		['-S', 'bettercap', '-caplet', capletPath, '-iface', BETTERCAP_IFACE],
		{ stdio: ['pipe', 'pipe', 'pipe'] }
	);

	proc.stdin.write(sudoPw + '\n');

	proc.stdout.on('data', (d) => {
		const msg = d.toString();
		if (msg.trim()) log('log', `[bettercap] ${msg.trim()}`);
	});
	proc.stderr.on('data', (d) => {
		const msg = d.toString();
		if (msg.includes('[sudo] password for')) return;
		if (msg.trim()) log('warn', `[bettercap] ${msg.trim()}`);
	});
	proc.on('close', (code) => {
		log('log', `🦈 bettercap exited (code ${code}).`);
		if (bettercapProc === proc) bettercapProc = null;
	});
	proc.on('error', (err) => {
		log('error', `🦈 bettercap spawn error: ${err.message}`);
		if (bettercapProc === proc) bettercapProc = null;
	});

	bettercapProc = proc;
}

/**
 * Stop the host bettercap. The process runs as root, so it is killed with a
 * privileged pkill using the sudo password retained from startBettercap.
 */
export function stopBettercap(log: Logger): void {
	if (!bettercapProc && !sudoPassword) return;

	const pw = sudoPassword;
	log('log', '🦈 Stopping bettercap...');

	const killer = spawn('sudo', ['-S', 'pkill', '-f', 'bettercap -caplet'], {
		stdio: ['pipe', 'pipe', 'pipe'],
	});
	if (pw) killer.stdin.write(pw + '\n');
	killer.stdin.end();
	killer.on('error', (err) => log('warn', `🦈 bettercap stop error: ${err.message}`));

	// Best-effort kill of the sudo wrapper too.
	try { bettercapProc?.kill(); } catch { /* ignore */ }

	bettercapProc = null;
	sudoPassword = null;
}

/**
 * Send a single bettercap command via its REST API (no auth).
 */
function bettercapApi(cmd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const body = JSON.stringify({ cmd });
		const req = http.request(
			{
				host: BETTERCAP_HOST,
				port: BETTERCAP_API_PORT,
				path: '/api/session',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(body),
					// Empty user:pass — harmless if the API is unauthenticated.
					Authorization: 'Basic ' + Buffer.from(':').toString('base64'),
				},
				timeout: 4000,
			},
			(res) => {
				res.resume();
				res.on('end', () => resolve());
			}
		);
		req.on('timeout', () => req.destroy(new Error('bettercap API timeout')));
		req.on('error', reject);
		req.write(body);
		req.end();
	});
}

/**
 * Point the running capture at a single machine (BPF `host <ip>`), or reset to
 * capture everything when `ip` is null. Returns the web UI URL to embed.
 */
export async function setBettercapFilter(ip: string | null, log: Logger): Promise<string> {
	// `host <ip>` narrows to one machine; `""` clears the BPF (capture everything).
	const filter = ip ? `host ${ip}` : '""';
	try {
		await bettercapApi(`set net.sniff.filter ${filter}`);
		// A BPF filter is applied at capture start, so restart the sniffer.
		await bettercapApi('net.sniff off');
		await bettercapApi('net.sniff on');
		log('log', `🦈 sniff filter set to ${ip ? `host ${ip}` : '(all machines)'}.`);
	} catch (e: any) {
		log('warn', `🦈 Could not set sniff filter: ${e.message}`);
	}
	return bettercapWebUrl();
}

export function bettercapWebUrl(): string {
	return `http://${BETTERCAP_HOST}:${BETTERCAP_UI_PORT}/`;
}
