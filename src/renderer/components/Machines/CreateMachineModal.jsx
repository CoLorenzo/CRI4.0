/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from 'uuid';
import {
    Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
    Button, Input, RadioGroup, Radio,
    CheckboxGroup, Checkbox, Switch,
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
    const [uploadedImage, setUploadedImage] = useState("");
    const [isLoadingImage, setIsLoadingImage] = useState(false);
    const [uploadImageError, setUploadImageError] = useState("");
    const uploadInputRef = useRef(null);
    const [envDefs, setEnvDefs] = useState([]);
    const [fileDefs, setFileDefs] = useState([]);
    const [dockerFlags, setDockerFlags] = useState([]);
    const [logo, setLogo] = useState("");
    const [startupScript, setStartupScript] = useState("");
    const [buildScript, setBuildScript] = useState("");
    const [buildState, setBuildState] = useState(null); // null | { building: bool, dockerOutput, success?, image?, scriptStdout?, scriptStderr? }
    const [builtImageTag, setBuiltImageTag] = useState("");
    const dockerOutputRef = useRef(null);
    const logoInputRef = useRef(null);
    const [activeTab, setActiveTab] = useState("base");
    const [showFullScript, setShowFullScript] = useState(false);
    const [showFullBuildScript, setShowFullBuildScript] = useState(false);

    useEffect(() => {
        if (isOpen && initialValues) {
            setName(initialValues.name || "");
            setBaseMode("manual");
            setManualImage(initialValues.image || "");
            setEnvDefs((initialValues.envDefs || []).map(e => ({ ...e, id: e.id || uuidv4() })));
            setFileDefs((initialValues.fileDefs || []).map(f => ({ ...f, id: f.id || uuidv4() })));
            setDockerFlags((initialValues.dockerFlags || []).map(f => ({ ...f, id: f.id || uuidv4() })));
            setLogo(initialValues.logo || "");
            setStartupScript(initialValues.startup || "");
            setBuildScript(initialValues.buildScript || "");
            setBuildState(null);
            setBuiltImageTag("");
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

    useEffect(() => {
        if (dockerOutputRef.current) {
            dockerOutputRef.current.scrollTop = dockerOutputRef.current.scrollHeight;
        }
    }, [buildState?.dockerOutput]);

    function handleSearch() {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        api.dockerSearch(searchQuery.trim())
            .then(results => setSearchResults(results || []))
            .catch(() => setSearchResults([]))
            .finally(() => setIsSearching(false));
    }

    function getSelectedImage() {
        if (baseMode === "local") return selectedLocalImage;
        if (baseMode === "upload") return uploadedImage;
        if (baseMode === "hub") return selectedHubImage;
        if (baseMode === "manual") return manualImage.trim();
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

    async function handleCreate() {
        if (!name.trim()) return;
        const image = getSelectedImage();

        if (buildScript.trim()) {
            // Already built successfully — save and close
            if (buildState?.success && !buildState?.building) {
                onCreate({ name: name.trim(), image, builtImage: builtImageTag, buildScript, envDefs, fileDefs, dockerFlags, logo, startup: startupScript });
                handleReset();
                return;
            }

            // Start build, then poll for result with live docker output
            setBuildState({ building: true, dockerOutput: '' });
            setActiveTab('build');

            const fullBuildScript = autoBuildTopPart.trim() + "\n\n" + buildScript.trim();

            let buildId;
            try {
                const resp = await api.buildCustomImage(name.trim(), image, fullBuildScript);
                buildId = resp.buildId;
            } catch (e) {
                setBuildState({ building: false, success: false, dockerOutput: String(e), scriptStdout: '', scriptStderr: '' });
                return;
            }

            const result = await new Promise(resolve => {
                const poll = async () => {
                    try {
                        const r = await api.getBuildResult(buildId);
                        setBuildState({ building: !r.done, dockerOutput: r.dockerOutput || '' });
                        if (r.done) { resolve(r); return; }
                    } catch {}
                    setTimeout(poll, 500);
                };
                poll();
            });

            setBuildState({ building: false, ...result });
            if (result.success) setBuiltImageTag(result.image || "");
            return;
        }

        // No build script — save and close directly
        onCreate({ name: name.trim(), image, builtImage: initialValues?.builtImage || "", buildScript: "", envDefs, fileDefs, dockerFlags, logo, startup: startupScript });
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
        setUploadedImage("");
        setIsLoadingImage(false);
        setUploadImageError("");
        setEnvDefs([]);
        setFileDefs([]);
        setDockerFlags([]);
        setLogo("");
        setStartupScript("");
        setBuildScript("");
        setBuildState(null);
        setBuiltImageTag("");
        setActiveTab("base");
        setShowFullScript(false);
        setShowFullBuildScript(false);
        onClose();
    }

    async function handleLoadDockerImage(file) {
        setIsLoadingImage(true);
        setUploadImageError("");
        try {
            const result = await api.loadDockerImage(file);
            if (result.canceled) { /* user dismissed dialog */ return; }
            if (result.error) { setUploadImageError(result.error); return; }
            setUploadedImage(result.tag || "");
        } catch (e) {
            setUploadImageError(String(e));
        } finally {
            setIsLoadingImage(false);
        }
    }

    function handleLogoUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setLogo(ev.target.result);
        reader.readAsDataURL(file);
        e.target.value = "";
    }

    function addFileDef() {
        setFileDefs(prev => [...prev, { id: uuidv4(), label: "", fileName: "", filePath: "/etc/", content: "" }]);
    }

    function removeFileDef(id) {
        setFileDefs(prev => prev.filter(f => f.id !== id));
    }

    function updateFileDef(id, field, value) {
        setFileDefs(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    }

    function handleFileDefUpload(id, e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => updateFileDef(id, "content", ev.target.result);
        reader.readAsText(file);
        e.target.value = "";
    }

    function addDockerFlag() {
        setDockerFlags(prev => [...prev, { id: uuidv4(), flag: "--", value: "" }]);
    }

    function removeDockerFlag(id) {
        setDockerFlags(prev => prev.filter(f => f.id !== id));
    }

    function updateDockerFlag(id, field, value) {
        setDockerFlags(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    }

    const autoBuildTopPart =
`#!/bin/sh
export DEBIAN_FRONTEND=noninteractive

# ── auto-generated: base tools ──
apt-get update -y 2>/dev/null || apt update -y 2>/dev/null || true
apt-get install -y iproute2 curl 2>/dev/null || apt install -y iproute2 curl 2>/dev/null || true

# ── auto-generated: smoloki ──
curl -LsSf https://astral.sh/uv/install.sh | sh 2>/dev/null || true
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
uv tool install smoloki --with requests 2>/dev/null || true`;

    const autoTopPart =
`#!/bin/sh

# ── auto-generated: network setup ──
echo 'nameserver 8.8.8.8' > /etc/resolv.conf 2>/dev/null || true
ip addr add <eth0_ip> dev eth0 2>/dev/null || true
ip link set eth0 up 2>/dev/null || true
# eth1+ interfaces added automatically if configured`;

    const autoBottomPart =
`# ── auto-generated: ready signal ──
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
smoloki -b http://10.1.0.254:3100 '{"job":"test","level":"info", "host": "'"$(hostname)"'"}' '{"message":"ready"}' 2>/dev/null || true`;

    return (
        <Modal isOpen={isOpen} onOpenChange={handleReset} size="3xl" scrollBehavior="inside">
            <ModalContent>
                {() => (
                    <>
                        <ModalHeader>Create Custom Machine</ModalHeader>
                        <ModalBody>
                            <div className="grid gap-4">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 rounded-xl border border-default-200 bg-default-100 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
                                        onClick={() => logoInputRef.current?.click()}
                                        title="Upload logo"
                                    >
                                        {logo ? (
                                            <img src={logo} alt="logo" className="w-full h-full object-contain" />
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-default-400">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                                <polyline points="21 15 16 10 5 21"/>
                                            </svg>
                                        )}
                                    </div>
                                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                    <div className="flex-1">
                                        <Input
                                            label="Machine Name"
                                            placeholder="e.g. my-server"
                                            value={name}
                                            onValueChange={setName}
                                            isRequired
                                        />
                                    </div>
                                    {logo && (
                                        <Button size="sm" variant="flat" color="danger" isIconOnly onPress={() => setLogo("")} title="Remove logo">
                                            <XSymbol size={14} />
                                        </Button>
                                    )}
                                </div>
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
                                                <Radio value="local">Local Registry</Radio>
                                                <Radio value="upload">Upload .tar</Radio>
                                                <Radio value="hub">Docker Hub</Radio>
                                                <Radio value="manual">Manual</Radio>
                                            </RadioGroup>

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

                                            {baseMode === "upload" && (
                                                <div className="grid gap-2">
                                                    {isLoadingImage ? (
                                                        <div className="flex items-center justify-center h-24 gap-2 text-sm text-default-400">
                                                            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                                            </svg>
                                                            Loading image…
                                                        </div>
                                                    ) : uploadedImage ? (
                                                        <div className="flex items-center justify-between p-3 bg-success-50 border border-success-200 rounded-xl">
                                                            <div>
                                                                <p className="text-xs text-success-600 font-medium">Image loaded</p>
                                                                <p className="font-mono text-sm text-success-800">{uploadedImage}</p>
                                                            </div>
                                                            <Button size="sm" variant="light" color="danger" onPress={() => { setUploadedImage(""); setUploadImageError(""); }}>
                                                                Clear
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <input
                                                                ref={uploadInputRef}
                                                                type="file"
                                                                accept=".tar"
                                                                className="sr-only"
                                                                onChange={(e) => { handleLoadDockerImage(e.target.files?.[0]); e.target.value = ""; }}
                                                            />
                                                            <label
                                                                className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-default-300 rounded-xl cursor-pointer bg-default-50 hover:bg-default-100 hover:border-primary transition-all"
                                                                onDragOver={(e) => e.preventDefault()}
                                                                onDrop={(e) => { e.preventDefault(); handleLoadDockerImage(e.dataTransfer.files?.[0]); }}
                                                                onClick={() => uploadInputRef.current?.click()}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-default-400">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                                                                </svg>
                                                                <span className="mt-1 text-xs font-medium text-default-600">Click or drag a Docker <code className="font-mono">.tar</code> file</span>
                                                                <span className="text-[10px] text-default-400 mt-0.5">Exported with <code className="font-mono">docker save</code></span>
                                                            </label>
                                                        </>
                                                    )}
                                                    {uploadImageError && (
                                                        <p className="text-xs text-danger-600 font-mono px-1">{uploadImageError}</p>
                                                    )}
                                                </div>
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

                                            {baseMode === "manual" && (
                                                <Input
                                                    label="Image"
                                                    placeholder="e.g. nginx:latest"
                                                    value={manualImage}
                                                    onValueChange={setManualImage}
                                                />
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
                                                        <Radio value="button">Button</Radio>
                                                        <Radio value="file">File</Radio>
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

                                                    {envDef.type === "button" && (
                                                        <div className="flex items-center gap-2">
                                                            <Switch
                                                                size="sm"
                                                                isSelected={envDef.value === "true"}
                                                                onValueChange={(v) => updateEnvDef(envDef.id, "value", v ? "true" : "false")}
                                                            />
                                                            <span className="text-xs text-default-500">Default: {envDef.value === "true" ? "true" : "false"}</span>
                                                        </div>
                                                    )}

                                                    {envDef.type === "file" && (
                                                        <div className="grid gap-2">
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    label="File name"
                                                                    placeholder="e.g. config.json"
                                                                    value={envDef.fileName || ""}
                                                                    onValueChange={(v) => updateEnvDef(envDef.id, "fileName", v)}
                                                                    size="sm"
                                                                    className="flex-1"
                                                                />
                                                                <Input
                                                                    label="Destination path"
                                                                    placeholder="e.g. /etc/myapp/"
                                                                    value={envDef.filePath || "/etc/"}
                                                                    onValueChange={(v) => updateEnvDef(envDef.id, "filePath", v)}
                                                                    size="sm"
                                                                    className="flex-1"
                                                                />
                                                            </div>
                                                            <Input
                                                                label="Accept (optional)"
                                                                placeholder="e.g. .json,.yaml"
                                                                value={envDef.accept || ""}
                                                                onValueChange={(v) => updateEnvDef(envDef.id, "accept", v)}
                                                                size="sm"
                                                                description="File types to accept in the upload picker"
                                                            />
                                                        </div>
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

                                    {/* ── FILES ── */}
                                    <Tab key="files" title="Files">
                                        <div className="grid gap-3 pt-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-default-500">Files to inject into the container</span>
                                                <Button
                                                    size="sm"
                                                    color="success"
                                                    className="text-white"
                                                    onPress={addFileDef}
                                                    endContent={<PlusSymbol fill="white" size={16} />}
                                                >
                                                    Add File
                                                </Button>
                                            </div>

                                            {fileDefs.length === 0 && (
                                                <p className="text-sm text-default-400 text-center py-4">
                                                    No files defined. Click "Add File" to add one.
                                                </p>
                                            )}

                                            {fileDefs.map((fileDef) => (
                                                <div key={fileDef.id} className="border rounded-lg p-3 grid gap-2">
                                                    <div className="flex gap-2 items-center">
                                                        <Input
                                                            label="Label"
                                                            placeholder="e.g. Main Config"
                                                            value={fileDef.label}
                                                            onValueChange={(v) => updateFileDef(fileDef.id, "label", v)}
                                                            size="sm"
                                                            className="flex-1"
                                                        />
                                                        <Button
                                                            isIconOnly
                                                            size="sm"
                                                            color="danger"
                                                            onPress={() => removeFileDef(fileDef.id)}
                                                        >
                                                            <XSymbol size={16} />
                                                        </Button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            label="File name"
                                                            placeholder="e.g. config.json"
                                                            value={fileDef.fileName}
                                                            onValueChange={(v) => updateFileDef(fileDef.id, "fileName", v)}
                                                            size="sm"
                                                            className="flex-1"
                                                        />
                                                        <Input
                                                            label="Destination path"
                                                            placeholder="e.g. /etc/myapp/"
                                                            value={fileDef.filePath}
                                                            onValueChange={(v) => updateFileDef(fileDef.id, "filePath", v)}
                                                            size="sm"
                                                            className="flex-1"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="flat"
                                                            onPress={() => {
                                                                const input = document.createElement("input");
                                                                input.type = "file";
                                                                input.onchange = (e) => handleFileDefUpload(fileDef.id, e);
                                                                input.click();
                                                            }}
                                                        >
                                                            {fileDef.content ? "Replace content" : "Upload content"}
                                                        </Button>
                                                        {fileDef.content && (
                                                            <>
                                                                <span className="text-xs text-success-600">✓ content loaded</span>
                                                                <Button size="sm" variant="flat" color="danger" onPress={() => updateFileDef(fileDef.id, "content", "")}>
                                                                    Clear
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Tab>

                                    {/* ── DOCKER FLAGS ── */}
                                    <Tab key="docker" title="Docker">
                                        <div className="grid gap-3 pt-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-default-500">
                                                    Extra flags passed to <code className="text-xs bg-default-100 px-1 rounded font-mono">docker run</code>
                                                </span>
                                                <Button
                                                    size="sm"
                                                    color="success"
                                                    className="text-white"
                                                    onPress={addDockerFlag}
                                                    endContent={<PlusSymbol fill="white" size={16} />}
                                                >
                                                    Add Flag
                                                </Button>
                                            </div>

                                            {dockerFlags.length === 0 && (
                                                <p className="text-sm text-default-400 text-center py-4">
                                                    No flags defined. Click "Add Flag" to add one.
                                                </p>
                                            )}

                                            {dockerFlags.length > 0 && (
                                                <div className="border border-default-200 rounded-lg overflow-hidden">
                                                    <div className="grid grid-cols-[1fr_1fr_auto] gap-0 text-xs text-default-400 px-3 py-1.5 bg-default-50 border-b border-default-200 font-mono">
                                                        <span>Flag</span>
                                                        <span>Value</span>
                                                        <span />
                                                    </div>
                                                    {dockerFlags.map((flag, idx) => (
                                                        <div
                                                            key={flag.id}
                                                            className={`grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-2 items-center ${idx !== dockerFlags.length - 1 ? "border-b border-default-100" : ""}`}
                                                        >
                                                            <input
                                                                className="w-full bg-transparent font-mono text-sm outline-none text-foreground placeholder:text-default-300"
                                                                placeholder="--device"
                                                                value={flag.flag}
                                                                onChange={(e) => updateDockerFlag(flag.id, "flag", e.target.value)}
                                                                spellCheck={false}
                                                            />
                                                            <input
                                                                className="w-full bg-transparent font-mono text-sm outline-none text-foreground placeholder:text-default-300"
                                                                placeholder="/dev/kvm"
                                                                value={flag.value}
                                                                onChange={(e) => updateDockerFlag(flag.id, "value", e.target.value)}
                                                                spellCheck={false}
                                                            />
                                                            <Button
                                                                isIconOnly
                                                                size="sm"
                                                                variant="light"
                                                                color="danger"
                                                                onPress={() => removeDockerFlag(flag.id)}
                                                            >
                                                                <XSymbol size={14} />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {dockerFlags.some(f => f.flag.trim()) && (
                                                <div className="px-3 py-2 bg-default-50 rounded-lg border border-default-200">
                                                    <p className="text-xs text-default-400 font-mono mb-1">Preview</p>
                                                    <p className="text-xs font-mono text-default-600 break-all">
                                                        {dockerFlags
                                                            .filter(f => f.flag.trim())
                                                            .map(f => f.value.trim() ? `${f.flag.trim()}=${f.value.trim()}` : f.flag.trim())
                                                            .join(" ")}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </Tab>

                                    {/* ── BUILD SCRIPT ── */}
                                    <Tab key="build" title="Build Script">
                                        <div className="grid gap-2 pt-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-default-500">
                                                    Executed during <code className="text-xs bg-default-100 px-1 rounded font-mono">docker build</code> — pre-install packages, configure the image layer.
                                                </p>
                                                <Button
                                                    size="sm"
                                                    variant="flat"
                                                    onPress={() => setShowFullBuildScript(v => !v)}
                                                >
                                                    {showFullBuildScript ? "Hide full script" : "Show full script"}
                                                </Button>
                                            </div>
                                            <div className="border border-default-200 rounded-lg overflow-hidden font-mono text-xs">
                                                {showFullBuildScript && (
                                                    <pre className="px-3 py-2 text-default-400 bg-default-100 border-b border-default-200 whitespace-pre leading-relaxed select-none">{autoBuildTopPart}</pre>
                                                )}
                                                <textarea
                                                    className="w-full px-3 py-2 bg-content1 resize-none outline-none text-foreground leading-relaxed"
                                                    placeholder={"# e.g.\napt-get install -y python3 git"}
                                                    value={buildScript}
                                                    onChange={(e) => {
                                                        setBuildScript(e.target.value);
                                                        if (buildState?.success && !buildState?.building) {
                                                            setBuildState(null);
                                                            setBuiltImageTag("");
                                                        }
                                                    }}
                                                    rows={10}
                                                    spellCheck={false}
                                                    style={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                                                />
                                            </div>
                                            {buildState && (
                                                <div className="grid gap-2">
                                                    {!buildState.building && (
                                                        <p className={`text-sm font-semibold font-mono px-1 ${buildState.success ? 'text-success-600' : 'text-danger-600'}`}>
                                                            {buildState.success ? `✓ ${buildState.image}` : '✗ Build failed'}
                                                        </p>
                                                    )}
                                                    <div>
                                                        <p className="text-xs text-default-400 font-mono mb-1">
                                                            docker build{buildState.building ? ' — building…' : ''}
                                                        </p>
                                                        <pre
                                                            ref={dockerOutputRef}
                                                            className="border border-default-200 rounded-lg px-3 py-2 text-xs font-mono whitespace-pre overflow-auto max-h-56 bg-zinc-950 text-zinc-300 leading-relaxed"
                                                        >{buildState.dockerOutput || ' '}</pre>
                                                    </div>
                                                    {!buildState.building && buildState.success && buildState.scriptStdout && (
                                                        <div>
                                                            <p className="text-xs text-default-400 font-mono mb-1">build.sh — stdout</p>
                                                            <pre className="border border-default-200 rounded-lg px-3 py-2 text-xs font-mono whitespace-pre overflow-auto max-h-40 bg-zinc-950 text-zinc-100 leading-relaxed">{buildState.scriptStdout}</pre>
                                                        </div>
                                                    )}
                                                    {!buildState.building && buildState.success && buildState.scriptStderr && (
                                                        <div>
                                                            <p className="text-xs text-default-400 font-mono mb-1">build.sh — stderr</p>
                                                            <pre className="border border-default-200 rounded-lg px-3 py-2 text-xs font-mono whitespace-pre overflow-auto max-h-40 bg-zinc-950 text-amber-400 leading-relaxed">{buildState.scriptStderr}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </Tab>

                                    {/* ── STARTUP ── */}
                                    <Tab key="startup" title="Startup Script">
                                        <div className="grid gap-2 pt-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-default-500">
                                                    Custom startup commands
                                                </p>
                                                <Button
                                                    size="sm"
                                                    variant="flat"
                                                    onPress={() => setShowFullScript(v => !v)}
                                                >
                                                    {showFullScript ? "Hide full script" : "Show full script"}
                                                </Button>
                                            </div>
                                            <div className="border border-default-200 rounded-lg overflow-hidden font-mono text-xs">
                                                {showFullScript && (
                                                    <pre className="px-3 py-2 text-default-400 bg-default-100 border-b border-default-200 whitespace-pre leading-relaxed select-none">{autoTopPart}</pre>
                                                )}
                                                <textarea
                                                    className="w-full px-3 py-2 bg-content1 resize-none outline-none text-foreground leading-relaxed"
                                                    placeholder="# Your startup commands here..."
                                                    value={startupScript}
                                                    onChange={(e) => setStartupScript(e.target.value)}
                                                    rows={6}
                                                    spellCheck={false}
                                                    style={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                                                />
                                                {showFullScript && (
                                                    <pre className="px-3 py-2 text-default-400 bg-default-100 border-t border-default-200 whitespace-pre leading-relaxed select-none">{autoBottomPart}</pre>
                                                )}
                                            </div>
                                        </div>
                                    </Tab>
                                </Tabs>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={handleReset}>
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                onPress={handleCreate}
                                isDisabled={!name.trim() || buildState?.building === true}
                                isLoading={buildState?.building === true}
                            >
                                {buildState?.success
                                    ? "Save Machine"
                                    : buildScript.trim() && !buildState
                                        ? "Build & Save"
                                        : initialValues ? "Update Machine" : "Create Machine"}
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
