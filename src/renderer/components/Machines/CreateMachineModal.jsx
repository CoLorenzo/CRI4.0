/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';
import {
    Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
    Button, Input, Textarea, RadioGroup, Radio,
    CheckboxGroup, Checkbox,
    Tabs, Tab, Select, SelectItem,
} from "@nextui-org/react";
import { api } from "../../api/index";
import { PlusSymbol } from "../Symbols/PlusSymbol";
import { XSymbol } from "../Symbols/XSymbol";

export default function CreateMachineModal({ isOpen, onClose, onCreate, initialValues }) {
    const [name, setName] = useState("");
    const [baseMode, setBaseMode] = useState("hub");
    const [manualImage, setManualImage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [selectedHubImage, setSelectedHubImage] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [localImages, setLocalImages] = useState([]);
    const [isLoadingLocal, setIsLoadingLocal] = useState(false);
    const [selectedLocalImage, setSelectedLocalImage] = useState("");
    const [envDefs, setEnvDefs] = useState([]);
    const [startupScript, setStartupScript] = useState("");
    const [activeTab, setActiveTab] = useState("base");

    useEffect(() => {
        if (isOpen && initialValues) {
            setName(initialValues.name || "");
            setBaseMode("manual");
            setManualImage(initialValues.image || "");
            setEnvDefs((initialValues.envDefs || []).map(e => ({ ...e, id: e.id || uuidv4() })));
            setStartupScript(initialValues.startup || "");
        }
    }, [isOpen]);

    useEffect(() => {
        if (baseMode === "local" && localImages.length === 0) {
            setIsLoadingLocal(true);
            api.getAllLocalImages()
                .then(imgs => setLocalImages(imgs || []))
                .catch(() => setLocalImages([]))
                .finally(() => setIsLoadingLocal(false));
        }
    }, [baseMode]);

    function handleSearch() {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        api.dockerSearch(searchQuery.trim())
            .then(results => setSearchResults(results || []))
            .catch(() => setSearchResults([]))
            .finally(() => setIsSearching(false));
    }

    function getSelectedImage() {
        if (baseMode === "manual") return manualImage.trim();
        if (baseMode === "hub") return selectedHubImage;
        if (baseMode === "local") return selectedLocalImage;
        return "";
    }

    function addEnvDef() {
        setEnvDefs(prev => [...prev, { id: uuidv4(), key: "", type: "textbox", entries: [], value: "" }]);
    }

    function removeEnvDef(id) {
        setEnvDefs(prev => prev.filter(e => e.id !== id));
    }

    function updateEnvDef(id, field, value) {
        setEnvDefs(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    }

    function addEntry(id) {
        setEnvDefs(prev => prev.map(e => e.id === id ? { ...e, entries: [...e.entries, ""] } : e));
    }

    function updateEntry(id, idx, value) {
        setEnvDefs(prev => prev.map(e =>
            e.id === id ? { ...e, entries: e.entries.map((en, i) => i === idx ? value : en) } : e
        ));
    }

    function removeEntry(id, idx) {
        setEnvDefs(prev => prev.map(e =>
            e.id === id ? { ...e, entries: e.entries.filter((_, i) => i !== idx), value: "" } : e
        ));
    }

    function handleCreate() {
        if (!name.trim()) return;
        onCreate({ name: name.trim(), image: getSelectedImage(), envDefs, startup: startupScript });
        handleReset();
    }

    function handleReset() {
        setName("");
        setBaseMode("manual");
        setManualImage("");
        setSearchQuery("");
        setSearchResults([]);
        setSelectedHubImage("");
        setLocalImages([]);
        setSelectedLocalImage("");
        setEnvDefs([]);
        setStartupScript("");
        setActiveTab("base");
        onClose();
    }

    const autoSetupPreview =
        `#!/bin/sh\necho 'nameserver 8.8.8.8' > /etc/resolv.conf\nip addr add <eth0_ip> dev eth0\nip link set eth0 up\n# eth1+ added automatically if configured`;

    return (
        <Modal isOpen={isOpen} onOpenChange={handleReset} size="3xl" scrollBehavior="inside">
            <ModalContent>
                {() => (
                    <>
                        <ModalHeader>Create Custom Machine</ModalHeader>
                        <ModalBody>
                            <div className="grid gap-4">
                                <Input
                                    label="Machine Name"
                                    placeholder="e.g. my-server"
                                    value={name}
                                    onValueChange={setName}
                                    isRequired
                                />
                                <Tabs
                                    selectedKey={activeTab}
                                    onSelectionChange={setActiveTab}
                                    aria-label="Machine configuration tabs"
                                >
                                    {/* ── BASE IMAGE ── */}
                                    <Tab key="base" title="Base Image">
                                        <div className="grid gap-3 pt-2">
                                            <RadioGroup
                                                value={baseMode}
                                                onValueChange={(v) => { setBaseMode(v); }}
                                                orientation="horizontal"
                                                label="Image source"
                                            >
                                                <Radio value="hub">Docker Hub</Radio>
                                                <Radio value="manual">Manual</Radio>
                                                <Radio value="local">Local Registry</Radio>
                                            </RadioGroup>

                                            {baseMode === "manual" && (
                                                <Input
                                                    label="Image"
                                                    placeholder="e.g. nginx:latest"
                                                    value={manualImage}
                                                    onValueChange={setManualImage}
                                                />
                                            )}

                                            {baseMode === "hub" && (
                                                <div className="grid gap-2">
                                                    <div className="flex gap-2 items-end">
                                                        <Input
                                                            label="Search Docker Hub"
                                                            placeholder="e.g. nginx"
                                                            value={searchQuery}
                                                            onValueChange={setSearchQuery}
                                                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                                            className="flex-1"
                                                        />
                                                        <Button
                                                            onPress={handleSearch}
                                                            color="primary"
                                                            isLoading={isSearching}
                                                        >
                                                            Search
                                                        </Button>
                                                    </div>
                                                    {searchResults.length > 0 && (
                                                        <div className="border rounded-lg overflow-auto max-h-52">
                                                            {searchResults.map((r) => {
                                                                const sel = selectedHubImage === r.Name;
                                                                return (
                                                                    <div
                                                                        key={r.Name}
                                                                        className={`flex justify-between items-center p-2 cursor-pointer ${sel ? "bg-[#DD4040] hover:bg-[#DD4040] text-white" : "hover:bg-default-100"}`}
                                                                        onClick={() => setSelectedHubImage(r.Name)}
                                                                    >
                                                                        <div>
                                                                            <div className="font-mono text-sm font-medium">{r.Name}</div>
                                                                            {r.Description && (
                                                                                <div className={`text-xs truncate max-w-sm ${sel ? "text-white/80" : "text-default-500"}`}>{r.Description}</div>
                                                                            )}
                                                                        </div>
                                                                        <div className={`text-xs ml-2 shrink-0 ${sel ? "text-white/80" : "text-default-400"}`}>★ {r.StarCount}</div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {baseMode === "local" && (
                                                <div className="grid gap-2">
                                                    {isLoadingLocal ? (
                                                        <p className="text-sm text-default-400">Loading local images...</p>
                                                    ) : localImages.length === 0 ? (
                                                        <p className="text-sm text-default-400">No local images found.</p>
                                                    ) : (
                                                        <div className="border rounded-lg overflow-auto max-h-52">
                                                            {localImages.map((img) => {
                                                                const sel = selectedLocalImage === img;
                                                                return (
                                                                    <div
                                                                        key={img}
                                                                        className={`p-2 cursor-pointer font-mono text-sm ${sel ? "bg-[#DD4040] hover:bg-[#DD4040] text-white" : "hover:bg-default-100"}`}
                                                                        onClick={() => setSelectedLocalImage(img)}
                                                                    >
                                                                        {img}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </Tab>

                                    {/* ── ENV VARIABLES ── */}
                                    <Tab key="env" title="Environment Variables">
                                        <div className="grid gap-3 pt-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-default-500">Define environment variables</span>
                                                <Button
                                                    size="sm"
                                                    color="success"
                                                    className="text-white"
                                                    onPress={addEnvDef}
                                                    endContent={<PlusSymbol fill="white" size={16} />}
                                                >
                                                    Add Variable
                                                </Button>
                                            </div>

                                            {envDefs.length === 0 && (
                                                <p className="text-sm text-default-400 text-center py-4">
                                                    No variables defined. Click "Add Variable" to add one.
                                                </p>
                                            )}

                                            {envDefs.map((envDef) => (
                                                <div key={envDef.id} className="border rounded-lg p-3 grid gap-2">
                                                    <div className="flex gap-2 items-center">
                                                        <Input
                                                            label="Key"
                                                            placeholder="VARIABLE_NAME"
                                                            value={envDef.key}
                                                            onValueChange={(v) => updateEnvDef(envDef.id, "key", v.toUpperCase().replace(/\s/g, "_"))}
                                                            size="sm"
                                                            className="flex-1"
                                                        />
                                                        <Button
                                                            isIconOnly
                                                            size="sm"
                                                            color="danger"
                                                            onPress={() => removeEnvDef(envDef.id)}
                                                        >
                                                            <XSymbol size={16} />
                                                        </Button>
                                                    </div>

                                                    <RadioGroup
                                                        label="Input type"
                                                        value={envDef.type}
                                                        onValueChange={(v) => updateEnvDef(envDef.id, "type", v)}
                                                        orientation="horizontal"
                                                        size="sm"
                                                    >
                                                        <Radio value="textbox">Textbox</Radio>
                                                        <Radio value="checkboxes">Checkboxes</Radio>
                                                        <Radio value="dropdown">Dropdown</Radio>
                                                    </RadioGroup>

                                                    {envDef.type === "textbox" && (
                                                        <Input
                                                            label="Value"
                                                            placeholder="Enter default value"
                                                            value={envDef.value}
                                                            onValueChange={(v) => updateEnvDef(envDef.id, "value", v)}
                                                            size="sm"
                                                        />
                                                    )}

                                                    {(envDef.type === "checkboxes" || envDef.type === "dropdown") && (
                                                        <div className="grid gap-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs text-default-500">Options</span>
                                                                <Button
                                                                    size="sm"
                                                                    variant="flat"
                                                                    onPress={() => addEntry(envDef.id)}
                                                                    endContent={<PlusSymbol size={14} />}
                                                                >
                                                                    Add Option
                                                                </Button>
                                                            </div>
                                                            {envDef.entries.map((entry, idx) => (
                                                                <div key={idx} className="flex gap-2 items-center">
                                                                    <Input
                                                                        size="sm"
                                                                        placeholder={`Option ${idx + 1}`}
                                                                        value={entry}
                                                                        onValueChange={(v) => updateEntry(envDef.id, idx, v)}
                                                                        className="flex-1"
                                                                    />
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="danger"
                                                                        onPress={() => removeEntry(envDef.id, idx)}
                                                                    >
                                                                        <XSymbol size={14} />
                                                                    </Button>
                                                                </div>
                                                            ))}

                                                            {envDef.entries.filter(e => e).length > 0 && envDef.type === "checkboxes" && (
                                                                <CheckboxGroup
                                                                    label="Default value"
                                                                    value={envDef.value ? envDef.value.split(",").filter(Boolean) : []}
                                                                    onValueChange={(vals) => updateEnvDef(envDef.id, "value", vals.join(","))}
                                                                    orientation="horizontal"
                                                                    size="sm"
                                                                >
                                                                    {envDef.entries.filter(e => e).map((entry) => (
                                                                        <Checkbox key={entry} value={entry}>{entry}</Checkbox>
                                                                    ))}
                                                                </CheckboxGroup>
                                                            )}

                                                            {envDef.entries.filter(e => e).length > 0 && envDef.type === "dropdown" && (
                                                                <Select
                                                                    label="Default value"
                                                                    selectedKeys={envDef.value ? new Set([envDef.value]) : new Set()}
                                                                    onSelectionChange={(keys) => updateEnvDef(envDef.id, "value", Array.from(keys)[0] || "")}
                                                                    size="sm"
                                                                >
                                                                    {envDef.entries.filter(e => e).map((entry) => (
                                                                        <SelectItem key={entry}>{entry}</SelectItem>
                                                                    ))}
                                                                </Select>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </Tab>

                                    {/* ── STARTUP ── */}
                                    <Tab key="startup" title="Startup Script">
                                        <div className="grid gap-3 pt-2">
                                            <p className="text-sm text-default-500">
                                                IP setup is auto-generated from configured interfaces. Add custom commands below.
                                            </p>
                                            <Textarea
                                                isReadOnly
                                                label="Auto-generated (read-only)"
                                                value={autoSetupPreview}
                                                classNames={{ input: "font-mono text-xs" }}
                                                minRows={5}
                                            />
                                            <Textarea
                                                label="Custom startup commands"
                                                placeholder="# Your startup commands here..."
                                                value={startupScript}
                                                onChange={(e) => setStartupScript(e.target.value)}
                                                minRows={6}
                                                classNames={{ input: "font-mono text-sm" }}
                                            />
                                        </div>
                                    </Tab>
                                </Tabs>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={handleReset}>
                                Cancel
                            </Button>
                            <Button color="primary" onPress={handleCreate} isDisabled={!name.trim()}>
                                {initialValues ? "Update Machine" : "Create Machine"}
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
