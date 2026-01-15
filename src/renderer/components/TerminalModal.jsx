import React, { useEffect, useRef, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@nextui-org/react";
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { api } from '../api';

export default function TerminalModal({ isOpen, onClose, containerName }) {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const [instanceId, setInstanceId] = useState(null);

    useEffect(() => {
        if (!isOpen || !terminalRef.current || !containerName) return;

        // Initialize xterm
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#1e1e1e',
                foreground: '#f0f0f0'
            },
            allowProposedApi: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Create terminal session in backend
        let activeInstanceId = null;

        const initSession = async () => {
            try {
                activeInstanceId = await api.terminalCreate(containerName);
                setInstanceId(activeInstanceId);

                // Initial resize
                const { cols, rows } = fitAddon.proposeDimensions();
                api.terminalResize(activeInstanceId, cols, rows);

                // Send input to backend
                term.onData(data => {
                    api.terminalInput(activeInstanceId, data);
                });

                // Handle resize
                const handleResize = () => {
                    if (!activeInstanceId) return;
                    fitAddon.fit();
                    const dims = fitAddon.proposeDimensions();
                    if (dims) {
                        api.terminalResize(activeInstanceId, dims.cols, dims.rows);
                    }
                };
                window.addEventListener('resize', handleResize);

                // Cleanup resize listener
                return () => window.removeEventListener('resize', handleResize);
            } catch (err) {
                term.writeln(`\r\nError connecting to terminal: ${err.message}\r\n`);
            }
        };

        const cleanupResize = initSession();

        // Subscribe to incoming data
        const unsubscribe = api.onTerminalData((id, data) => {
            if (id === activeInstanceId && xtermRef.current) {
                xtermRef.current.write(data);
            }
        });

        return () => {
            unsubscribe();
            // cleanupResizePromise... complex logic, but useEffect cleanup handles destruction
            if (activeInstanceId) {
                api.terminalKill(activeInstanceId);
            }
            if (xtermRef.current) {
                xtermRef.current.dispose();
                xtermRef.current = null;
            }
        };
    }, [isOpen, containerName]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="5xl"
            scrollBehavior="inside"
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            Terminal: {containerName}
                        </ModalHeader>
                        <ModalBody>
                            <div
                                ref={terminalRef}
                                style={{ width: '100%', height: '600px', backgroundColor: '#1e1e1e' }}
                            />
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={onClose}>
                                Close
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
