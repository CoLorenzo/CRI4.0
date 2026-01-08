export function getMachineIps(machines) {
    let collectorIpCounter = 1;
    const machineIps = {};

    machines.forEach(machine => {
        const rawName = machine.type === "attacker" ? "attacker" : machine.name;
        const machineName = String(rawName || "node").replace(/[^\w.-]/g, "_");
        let ip = "";

        if (machineName === "collector") {
            ip = "20.0.0.254";
        } else {
            ip = `20.0.0.${collectorIpCounter}`;
            collectorIpCounter++;
        }

        // Store by ID (machine name usually serves as ID in this system)
        machineIps[machineName] = ip;
        // Also store by original name just in case
        if (machine.name) {
            machineIps[machine.name] = ip;
        }
    });

    return machineIps;
}
