/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import { Input, CheckboxGroup, Checkbox, Select, SelectItem } from "@nextui-org/react";

export function CustomMachineFunctions({ machine, machines, setMachines }) {
    function updateEnvValue(defId, newValue) {
        setMachines(machines.map(m =>
            m.id !== machine.id ? m : {
                ...m,
                other: {
                    ...m.other,
                    envDefs: (m.other?.envDefs || []).map(d =>
                        d.id === defId ? { ...d, value: newValue } : d
                    ),
                },
            }
        ));
    }

    const envDefs = machine.other?.envDefs || [];

    if (envDefs.length === 0) {
        return (
            <p className="text-xs text-default-400">
                No environment variables defined for this custom machine.
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
        </div>
    );
}
