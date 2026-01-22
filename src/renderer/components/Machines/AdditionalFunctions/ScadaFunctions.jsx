/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { CheckboxGroup, Checkbox } from "@nextui-org/react";

export function ScadaFunctions({ machine, machines, setMachines }) {
    // Find all industrial machines on the same subnet (same eth0 domain)
    // Industrial types: engine, fan, temperature_sensor, rejector, scada, apg, laser, conveyor, plc
    const industrialTypes = [
        "engine",
        "fan",
        "temperature_sensor",
        "rejector",
        "scada",
        "apg",
        "laser",
        "conveyor",
        "plc"
    ];

    const machineEth0Domain = machine.interfaces?.if?.[0]?.eth?.domain;

    const availableMachines = machines.filter((m) => {
        // Must be an industrial type
        if (!industrialTypes.includes(m.type)) return false;
        // Exclude self
        if (m.id === machine.id) return false;

        // Check if the machine is on the same eth0 domain (subnet)
        const mEth0Domain = m.interfaces?.if?.[0]?.eth?.domain;
        return mEth0Domain && mEth0Domain === machineEth0Domain;
    });

    const selectedMachines = machine.scada?.monitored_machines || [];

    function handleSelectionChange(values) {
        setMachines(machines.map((m) => {
            if (m.id === machine.id) {
                return {
                    ...m,
                    scada: {
                        ...(m.scada || {}),
                        monitored_machines: values
                    }
                };
            }
            return m;
        }));
    }

    return (
        <div>
            <div className="mb-2">
                <label className="text-sm font-semibold">Monitored Machines</label>
                <p className="text-xs text-text/50">
                    Select industrial machines in the same subnet (eth0)
                </p>
            </div>

            {availableMachines.length > 0 ? (
                <CheckboxGroup
                    color="primary"
                    value={selectedMachines}
                    onValueChange={handleSelectionChange}
                >
                    {availableMachines.map((m) => (
                        <Checkbox key={m.id} value={m.id}>
                            {m.name} ({m.interfaces?.if?.[0]?.ip || "no IP"})
                        </Checkbox>
                    ))}
                </CheckboxGroup>
            ) : (
                <div className="text-sm text-text/50 p-2 bg-default-100 rounded">
                    No industrial machines available on the same subnet (eth0).
                    Add industrial machines and connect them to the same collision domain.
                </div>
            )}
        </div>
    );
}
