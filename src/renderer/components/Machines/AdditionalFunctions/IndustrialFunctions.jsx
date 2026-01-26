/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { RadioGroup, Radio } from "@nextui-org/radio";
import { Input } from "@nextui-org/input";

export function IndustrialFunctions({ machine, machines, setMachines }) {
    // Find all engines on the same subnet (same eth0 domain)
    const machineEth0Domain = machine.interfaces?.if?.[0]?.eth?.domain;

    const availableEngines = machines.filter((m) => {
        if (m.type !== "engine") return false;
        if (m.id === machine.id) return false;

        // Check if the engine is on the same eth0 domain (subnet)
        const engineEth0Domain = m.interfaces?.if?.[0]?.eth?.domain;
        return engineEth0Domain && engineEth0Domain === machineEth0Domain;
    });

    function handleMachineModeChange(isSineWave) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    industrial: {
                        ...(m.industrial || {}),
                        sineWave: isSineWave
                    }
                };
            }
            return m;
        }));
    }

    function handleSineWaveParamChange(param, value) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    industrial: {
                        ...(m.industrial || {}),
                        [param]: value
                    }
                };
            }
            return m;
        }));
    }

    function handleEngineChange(selectedEngineId) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    industrial: {
                        ...(m.industrial || {}),
                        selectedEngineId: selectedEngineId || null
                    }
                };
            }
            return m;
        }));
    }

    function handleCapacityChange(capacity) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    industrial: {
                        ...(m.industrial || {}),
                        capacity: capacity
                    }
                };
            }
            return m;
        }));
    }

    return (
        <div>
            {machine.type === "temperature_sensor" && (
                <div className="mb-4">
                    <label className="text-sm font-semibold">Operation Mode</label>
                    <RadioGroup
                        orientation="horizontal"
                        value={machine.industrial?.sineWave ? "sine" : "engine"}
                        onValueChange={(val) => handleMachineModeChange(val === "sine")}
                    >
                        <Radio value="engine">Engine Connection</Radio>
                        <Radio value="sine">Sine Wave Simulation</Radio>
                    </RadioGroup>
                </div>
            )}

            {(!machine.industrial?.sineWave) && (
                <>
                    <div className="mb-2">
                        <label className="text-sm font-semibold">Machine Selection</label>
                        <p className="text-xs text-text/50">
                            Select an engine from the same subnet (eth0)
                        </p>
                    </div>

                    {availableEngines.length > 0 ? (
                        <RadioGroup
                            color="primary"
                            value={machine.industrial?.selectedEngineId || ""}
                            onValueChange={handleEngineChange}
                        >
                            <Radio value="">None</Radio>
                            {availableEngines.map((engine) => (
                                <Radio key={engine.id} value={engine.id}>
                                    {engine.name} ({engine.interfaces?.if?.[0]?.ip || "no IP"})
                                </Radio>
                            ))}
                        </RadioGroup>
                    ) : (
                        <div className="text-sm text-text/50 p-2 bg-default-100 rounded">
                            No engines available on the same subnet (eth0).
                            Add an engine and connect it to the same collision domain.
                        </div>
                    )}
                </>
            )}

            {machine.type === "temperature_sensor" && machine.industrial?.sineWave && (
                <div className="mt-2 flex flex-col gap-2">
                    <Input
                        type="number"
                        label="Period"
                        placeholder="10"
                        value={machine.industrial?.period || ""}
                        onChange={(e) => handleSineWaveParamChange("period", e.target.value)}
                        description="Wave period in seconds"
                    />
                    <Input
                        type="number"
                        label="Amplitude"
                        placeholder="10"
                        value={machine.industrial?.amplitude || ""}
                        onChange={(e) => handleSineWaveParamChange("amplitude", e.target.value)}
                        description="Wave amplitude (C)"
                    />
                    <Input
                        type="number"
                        label="Temp Offset"
                        placeholder="20"
                        value={machine.industrial?.tempOffset || ""}
                        onChange={(e) => handleSineWaveParamChange("tempOffset", e.target.value)}
                        description="Temperature offset (C)"
                    />
                </div>
            )}

            {machine.type === "fan" && (
                <div className="mt-4">
                    <Input
                        type="number"
                        label="Capacity"
                        placeholder="2.0"
                        value={machine.industrial?.capacity || ""}
                        onChange={(e) => handleCapacityChange(e.target.value)}
                        description="Fan capacity value"
                    />
                </div>
            )}
        </div>
    );
}
