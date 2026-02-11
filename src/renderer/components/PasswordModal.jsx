import React, { useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input } from "@nextui-org/react";

export default function PasswordModal({ isOpen, onClose, onSubmit }) {
    const [password, setPassword] = useState("");

    const handleSubmit = () => {
        onSubmit(password);
        setPassword(""); // Clear password after submit 
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            placement="center"
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">Sudo Password Required</ModalHeader>
                        <ModalBody>
                            <p className="text-sm text-default-500">
                                Kathara requires root privileges to configure network interfaces.
                                Please enter your sudo password to proceed.
                            </p>
                            <Input
                                autoFocus
                                type="password"
                                label="Sudo Password"
                                placeholder="Enter your password"
                                variant="bordered"
                                value={password}
                                onValueChange={setPassword}
                                onKeyDown={handleKeyDown}
                            />
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={onClose}>
                                Cancel
                            </Button>
                            <Button color="primary" onPress={handleSubmit}>
                                Start Simulation
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
