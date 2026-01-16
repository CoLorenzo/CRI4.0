/* eslint-disable react/jsx-no-target-blank */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable no-else-return */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { Checkbox } from "@nextui-org/checkbox";
import { Switch } from "@nextui-org/switch";

export function NGFWFunctions({ machine, machines, setMachines }) {
    function handleChange(value, targetMachineId) {
        setMachines(() =>
            machines.map((m) => {
                if (m.id === machine.id) {
                    return {
                        ...m,
                        ngfw: {
                            ...(m.ngfw || {}),
                            targetMachines: {
                                ...(m.ngfw?.targetMachines || {}),
                                [targetMachineId]: value,
                            },
                        },
                    };
                } else {
                    return m;
                }
            })
        );
    }

    function handleToggleRole(value) {
        setMachines(() =>
            machines.map((m) => {
                if (m.id === machine.id) {
                    return {
                        ...m,
                        ngfw: {
                            ...(m.ngfw || {}),
                            useFwknop: value,
                        },
                    };
                } else {
                    return m;
                }
            })
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <Switch
                isSelected={machine.ngfw?.useFwknop || false}
                onValueChange={handleToggleRole}
            >
                Use fwknop
            </Switch>

            {machine.ngfw?.useFwknop && (
                <>
                    <label className="text-sm font-semibold mt-2">Target Machines</label>
                    <div className="grid grid-cols-2 gap-2">
                        {machines
                            .filter((m) => m.id !== machine.id) // Optionally exclude self
                            .map((m) => (
                                <Checkbox
                                    key={m.id}
                                    isSelected={machine.ngfw?.targetMachines?.[m.id] || false}
                                    onValueChange={(value) => handleChange(value, m.id)}
                                >
                                    {m.name || `Machine ${m.id.substring(0, 4)}`}
                                </Checkbox>
                            ))}
                    </div>
                    {machines.length <= 1 && (
                        <div className="text-sm text-gray-400 italic">No other machines created.</div>
                    )}
                </>
            )}
        </div>
    );
}
