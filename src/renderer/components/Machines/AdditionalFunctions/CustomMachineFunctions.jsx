/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { useRef, useState } from "react";
import { Input, CheckboxGroup, Checkbox, Select, SelectItem, Switch, Button } from "@nextui-org/react";
import { MdFileUpload, MdDelete } from "react-icons/md";

function FileDropZone({ envDef, onUpload, onClear }) {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef(null);

    function readFile(file) {
        const reader = new FileReader();
        reader.onload = (ev) => onUpload(file.name, ev.target.result);
        reader.readAsText(file);
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) readFile(file);
    }

    function handleChange(e) {
        const file = e.target.files?.[0];
        if (file) readFile(file);
        e.target.value = "";
    }

    const hasContent = !!envDef.value;
    const uploadedName = envDef._uploadedName || envDef.fileName || "";

    return (
        <div className="grid gap-1">
            <p className="text-sm text-default-700">{envDef.key}</p>
            <p className="text-xs text-default-400 font-mono">{envDef.filePath}{envDef.fileName}</p>
            <input
                ref={inputRef}
                type="file"
                accept={envDef.accept || undefined}
                className="sr-only"
                onChange={handleChange}
            />
            {!hasContent ? (
                <label
                    className={`flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-xl cursor-pointer transition-all
                        ${dragging ? "border-primary bg-primary/10" : "border-default-300 bg-default-50 hover:bg-default-100 hover:border-primary"}`}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                >
                    <MdFileUpload className={`text-2xl transition-colors ${dragging ? "text-primary" : "text-default-400"}`} />
                    <span className={`mt-1 text-xs font-medium transition-colors ${dragging ? "text-primary" : "text-default-600"}`}>
                        {dragging ? "Drop to upload" : "Click or drag file here"}
                    </span>
                    {envDef.accept && (
                        <span className="text-[10px] text-default-400 mt-0.5">{envDef.accept}</span>
                    )}
                </label>
            ) : (
                <div className="flex items-center justify-between p-2 bg-success-50 rounded-xl border border-success-200">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-success-100 rounded-lg text-success-600">
                            <MdFileUpload className="text-lg" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-success-800 line-clamp-1">{uploadedName}</span>
                            <span className="text-[10px] text-success-600">File loaded</span>
                        </div>
                    </div>
                    <Button isIconOnly size="sm" variant="light" color="danger" onPress={onClear}>
                        <MdDelete className="text-lg" />
                    </Button>
                </div>
            )}
        </div>
    );
}

export function CustomMachineFunctions({ machine, machines, setMachines }) {
    const fileInputRefs = useRef({});

    function updateMachineOther(updater) {
        setMachines(machines.map(m =>
            m.id !== machine.id ? m : { ...m, other: updater(m.other) }
        ));
    }

    function updateEnvValue(defId, newValue, extra) {
        updateMachineOther(other => ({
            ...other,
            envDefs: (other.envDefs || []).map(d =>
                d.id === defId ? { ...d, value: newValue, ...extra } : d
            ),
        }));
    }

    function updateFileDefContent(defId, content) {
        updateMachineOther(other => ({
            ...other,
            fileDefs: (other.fileDefs || []).map(f =>
                f.id === defId ? { ...f, content } : f
            ),
        }));
    }

    function handleFileDefUpload(defId, e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => updateFileDefContent(defId, ev.target.result);
        reader.readAsText(file);
        e.target.value = "";
    }

    const envDefs = machine.other?.envDefs || [];
    const fileDefs = machine.other?.fileDefs || [];

    const hasContent = envDefs.length > 0 || fileDefs.length > 0;

    if (!hasContent) {
        return (
            <p className="text-xs text-default-400">
                No variables or files defined for this custom machine.
            </p>
        );
    }

    return (
        <div className="grid gap-3">
            {envDefs.map((envDef) => {
                if (envDef.type === "textbox") {
                    return (
                        <Input
                            key={envDef.id}
                            label={envDef.key}
                            value={envDef.value || ""}
                            onValueChange={(v) => updateEnvValue(envDef.id, v)}
                            size="sm"
                            variant="flat"
                        />
                    );
                }

                if (envDef.type === "button") {
                    return (
                        <div key={envDef.id} className="flex items-center gap-3">
                            <span className="text-sm text-default-700">{envDef.key}</span>
                            <Switch
                                size="sm"
                                isSelected={envDef.value === "true"}
                                onValueChange={(v) => updateEnvValue(envDef.id, v ? "true" : "false")}
                            />
                            <span className="text-xs text-default-400">{envDef.value === "true" ? "true" : "false"}</span>
                        </div>
                    );
                }

                if (envDef.type === "file") {
                    return (
                        <FileDropZone
                            key={envDef.id}
                            envDef={envDef}
                            onUpload={(fileName, content) => updateEnvValue(envDef.id, content, { _uploadedName: fileName })}
                            onClear={() => updateEnvValue(envDef.id, "", { _uploadedName: "" })}
                        />
                    );
                }

                if (envDef.type === "checkboxes") {
                    const checked = envDef.value
                        ? envDef.value.split(",").filter(Boolean)
                        : [];
                    return (
                        <CheckboxGroup
                            key={envDef.id}
                            label={envDef.key}
                            value={checked}
                            onValueChange={(vals) => updateEnvValue(envDef.id, vals.join(","))}
                            orientation="horizontal"
                            size="sm"
                        >
                            {(envDef.entries || []).filter(e => e).map(entry => (
                                <Checkbox key={entry} value={entry}>{entry}</Checkbox>
                            ))}
                        </CheckboxGroup>
                    );
                }

                if (envDef.type === "dropdown") {
                    return (
                        <Select
                            key={envDef.id}
                            label={envDef.key}
                            selectedKeys={envDef.value ? new Set([envDef.value]) : new Set()}
                            onSelectionChange={(keys) =>
                                updateEnvValue(envDef.id, Array.from(keys)[0] || "")
                            }
                            size="sm"
                        >
                            {(envDef.entries || []).filter(e => e).map(entry => (
                                <SelectItem key={entry}>{entry}</SelectItem>
                            ))}
                        </Select>
                    );
                }

                return null;
            })}

            {fileDefs.length > 0 && (
                <div className="grid gap-2 pt-1 border-t border-default-100">
                    <p className="text-xs text-default-400 font-medium">Files</p>
                    {fileDefs.map((fileDef) => (
                        <div key={fileDef.id} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-default-700 truncate">{fileDef.label || fileDef.fileName}</p>
                                <p className="text-xs text-default-400 font-mono truncate">{fileDef.filePath}{fileDef.fileName}</p>
                            </div>
                            <input
                                ref={el => { fileInputRefs.current[fileDef.id] = el; }}
                                type="file"
                                className="hidden"
                                onChange={(e) => handleFileDefUpload(fileDef.id, e)}
                            />
                            <Button
                                size="sm"
                                variant="flat"
                                color={fileDef.content ? "success" : "default"}
                                onPress={() => fileInputRefs.current[fileDef.id]?.click()}
                            >
                                {fileDef.content ? "✓ Replace" : "Upload"}
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
