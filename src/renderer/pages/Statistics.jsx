/* eslint-disable prettier/prettier */
import { useState, useEffect } from "react";
import { Button } from "@nextui-org/react";
import { MdRefresh, MdOpenInNew } from "react-icons/md";
import { api } from "../api";

export default function Statistics() {
    const [url, setUrl] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        api.arkimeStatsUrl()
            .then((u) => { if (!cancelled) setUrl(u); })
            .catch((e) => console.error("Failed to get Arkime URL", e));
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 gap-2">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h1 className="text-xl font-semibold">Statistics</h1>
                    <p className="text-xs text-default-500">
                        Arkime traffic analysis. Available while a simulation is running.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="flat"
                        startContent={<MdRefresh />}
                        onPress={() => setReloadKey((k) => k + 1)}
                    >
                        Reload
                    </Button>
                    {url && (
                        <Button
                            size="sm"
                            variant="flat"
                            startContent={<MdOpenInNew />}
                            onPress={() => window.open(url, "_blank")}
                        >
                            Open in browser
                        </Button>
                    )}
                </div>
            </div>
            <div className="flex-1 bg-white rounded-md overflow-hidden border border-default-200">
                {url ? (
                    <iframe
                        key={reloadKey}
                        src={url}
                        title="Arkime"
                        className="w-full h-full border-none"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-default-400">
                        Loading Arkime…
                    </div>
                )}
            </div>
        </div>
    );
}
