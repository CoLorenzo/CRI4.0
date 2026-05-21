/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable prettier/prettier */
import { Button } from "@nextui-org/react";
import { MdFileUpload, MdDelete } from "react-icons/md";

export function NetproxyFunctions({ machine, machines, setMachines }) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">Upload Config (config.json)</label>
            {!machine.netproxy?.configName ? (
                <div className="relative group">
                    <input
                        type="file"
                        accept=".json"
                        id={`netproxy-config-upload-${machine.id}`}
                        className="sr-only"
                        onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                                setMachines(machines.map((m) => {
                                    if (m.id === machine.id) {
                                        return {
                                            ...m,
                                            netproxy: {
                                                ...(m.netproxy || {}),
                                                configName: file.name,
                                                configContent: reader.result,
                                            },
                                        };
                                    }
                                    return m;
                                }));
                            };
                            reader.readAsDataURL(file);
                        }}
                    />
                    <label
                        htmlFor={`netproxy-config-upload-${machine.id}`}
                        className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-default-300 rounded-xl cursor-pointer bg-default-50 hover:bg-default-100 hover:border-primary transition-all group"
                    >
                        <MdFileUpload className="text-2xl text-default-400 group-hover:text-primary transition-colors" />
                        <span className="mt-1 text-xs font-medium text-default-600 group-hover:text-primary">
                            Click to upload config.json
                        </span>
                    </label>
                </div>
            ) : (
                <div className="flex items-center justify-between p-2 bg-success-50 rounded-xl border border-success-200">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-success-100 rounded-lg text-success-600">
                            <MdFileUpload className="text-lg" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-success-800 line-clamp-1">
                                {machine.netproxy.configName}
                            </span>
                            <span className="text-[10px] text-success-600">Config loaded</span>
                        </div>
                    </div>
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        aria-label="Remove config"
                        onClick={() => {
                            setMachines(machines.map((m) => {
                                if (m.id === machine.id) {
                                    const { configName, configContent, ...rest } = m.netproxy || {};
                                    return { ...m, netproxy: rest };
                                }
                                return m;
                            }));
                        }}
                    >
                        <MdDelete className="text-lg" />
                    </Button>
                </div>
            )}
        </div>
    );
}
