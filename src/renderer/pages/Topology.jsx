/* eslint-disable import/no-duplicates */
/* eslint-disable prettier/prettier */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Graph from "react-graph-vis";
import { makeGraph } from "../scripts/draw";
import { useState, useEffect } from "react";
import { Accordion, AccordionItem, Button, Card, CardBody } from "@nextui-org/react";
import { Checkbox, CheckboxGroup } from "@nextui-org/react";
import { Select, SelectItem } from "@nextui-org/react";
import { Slider } from "@nextui-org/react";
import TopologyGraph from "../components/TopologyGraph";
import TerminalModal from "../components/TerminalModal";
import UIModal from "../components/UIModal";
import { toast } from 'react-hot-toast';
import LogsModal from "../components/LogsModal";
import { getMachineIps } from "../utils/ipUtils";
import { useContext } from "react";
import { NotificationContext } from "../contexts/NotificationContext";
import { api } from "../api";


function Topology() {

  const [attackInProgress, setAttackInProgress] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  // Terminal Modal State
  const [terminalModalOpen, setTerminalModalOpen] = useState(false);
  const [terminalNode, setTerminalNode] = useState(null);

  // UI Modal State
  const [uiModal, setUiModal] = useState({ isOpen: false, url: "", title: "" });

  // Logs Modal State
  const [logsModal, setLogsModal] = useState({ isOpen: false, containerName: "" });

  const [simulationRun, setSimulationRun] = useState(() => {
    try { return JSON.parse(localStorage.getItem('simulationRun') || 'false'); }
    catch { return false; }
  });
  const [stopSimulation, setStopSimulation] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stopSimulation') || 'false'); }
    catch { return false; }
  });

  useEffect(() => {
    const storedSimulationRun = JSON.parse(localStorage.getItem('simulationRun') || 'false');
    const storedStopSimulation = JSON.parse(localStorage.getItem('stopSimulation') || 'false');

    if (storedSimulationRun && storedStopSimulation) {
      // Inconsistent state: simulation was running but also stopped. Reset both.
      setSimulationRun(false);
      setStopSimulation(false);
      localStorage.setItem('simulationRun', 'false');
      localStorage.setItem('stopSimulation', 'false');
    }
  }, []);

  const [showSimulationBanner, setShowSimulationBanner] = useState(false);



  const [labInfo, setLabInfo] = useState(() => {
    const savedLab = localStorage.getItem("labInfo");
    return savedLab ? JSON.parse(savedLab) : { name: "default-lab" };
  });


  useEffect(() => {
    localStorage.setItem('simulationRun', JSON.stringify(simulationRun));
  }, [simulationRun]);

  useEffect(() => {
    localStorage.setItem('stopSimulation', JSON.stringify(stopSimulation));
  }, [stopSimulation]);




  useEffect(() => {
    if (attackInProgress && progress >= 100) {
      const timeout = setTimeout(() => {
        setAttackInProgress(false);
        setShowTimer(false);
        setProgress(0);
      }, 1000); // attesa finale opzionale

      return () => clearTimeout(timeout);
    }
  }, [progress, attackInProgress]);



  const [machines, setMachines] = useState(() => {
    const savedMachines = localStorage.getItem("machines");
    return savedMachines ? JSON.parse(savedMachines) : [];
  });




  const { attackLoaded } = useContext(NotificationContext);


  const simulateAttack = async () => {
    const attacker = machines.find((m) => m.type === "attacker");
    console.log("simulateAttack triggered");
    console.log("attacker:", attacker);

    if (!attacker) {
      console.warn("⚠️ No attacker machine found.");
      return;
    }

    if (!attacker.attackLoaded) {
      console.warn("⚠️ Attack not loaded on attacker.");
      return;
    }

    // Preferiamo usare attackCommandArgs (array). Se non esiste, facciamo fallback
    const commandArgs =
      Array.isArray(attacker.attackCommandArgs) && attacker.attackCommandArgs.length > 0
        ? attacker.attackCommandArgs
        : (typeof attacker.attackCommand === 'string'
          ? attacker.attackCommand.trim().split(/\s+/)
          : []);

    if (!Array.isArray(commandArgs) || commandArgs.length === 0) {
      console.warn("⚠️ Nessun comando valido da inviare al main.");
      return;
    }

    console.log("✅ Launching attack args:", commandArgs);

    setAttackInProgress(true);
    setShowTimer(true);
    setProgress(0);

    // start timer/progress (comportamento originale: 4 secondi)
    let seconds = 0;
    const interval = setInterval(() => {
      seconds += 1;
      setProgress((seconds / 4) * 100); // progress in %
      if (seconds >= 4) {
        clearInterval(interval);
        setTimeout(() => {
          setShowTimer(false);
          setAttackInProgress(false);
        }, 1000); // attesa finale per chiusura pulita
      }
    }, 1000);

    // Fix: attacker machine is always named "attacker" in Kathara, but state might have image name.
    const targetContainer = attacker.type === "attacker" ? "attacker" : attacker.name;
    try {
      const output = await api.simulateAttack(targetContainer, commandArgs);
      console.log("Attack output:", output);
      if (output) {
        toast.success(
          <div>
            <b>Attack executed:</b>
            <pre className="text-xs mt-1 whitespace-pre-wrap max-h-40 overflow-auto">{output}</pre>
          </div>,
          { duration: 5000 }
        );
      } else {
        toast.success("Attack command sent (no output returned).");
      }

    } catch (e) {
      console.error("Attack error", e);
      toast.error("Attack failed: " + e.message);
    }
    // nota: lo stato (attackInProgress/showTimer) viene chiuso dal timer sopra
  };

  /* const simulateAttack = async () => {
 const attacker = machines.find((m) => m.type === "attacker");
 console.log("simulateAttack triggered");
 console.log("attacker:", attacker);

 if (!attacker) {
   console.warn("⚠️ No attacker machine found.");
   return;
 }

 if (!attacker.attackLoaded) {
   console.warn("⚠️ Attack not loaded on attacker.");
   return;
 }

 // Se arrivi qui, IPC verrà chiamato
 console.log("✅ Launching attack:", attacker.attackCommand);

 setAttackInProgress(true);
 setShowTimer(true);
 setProgress(0);

 try {
   await api.simulateAttack(attacker.name, attacker.attackCommand);
 } catch (e) {
   console.error("Attack error", e);
 }



 let seconds = 0;
 const interval = setInterval(() => {
   seconds += 1;
   setProgress((seconds / 4) * 100); // progress in %
   if (seconds >= 4) {
     clearInterval(interval);
     setTimeout(() => {
       setShowTimer(false);
       setAttackInProgress(false);
     }, 1000); // attesa finale per chiusura pulita
   }
 }, 1000);
};*/

  const handleStopSimulation = async () => {
    setStopSimulation(true);
    try {
      await api.stopSimulation();
    } catch (e) {
      console.error("Stop simulation error:", e);
    } finally {
      setSimulationRun(false);
    }
  };



  return (
    <div className="grid min-h-[calc(100vh-4rem)] gap-2 p-4">
      <div className="grid h-[calc(100vh-10rem)] items-center">
        <div className="bg-white h-full rounded-xl">
          {machines.every((m) => m.name === "") && (
            <div className="grid place-items-center h-full">
              <h1 className="text-background">No machines</h1>
            </div>
          ) || (
              <div className="h-full">
                <TopologyGraph
                  machines={machines}
                  onOpenTerminal={(nodeId) => {
                    setTerminalNode(nodeId);
                    setTerminalModalOpen(true);
                  }}
                  onOpenUI={async (nodeId) => {
                    // machine-name -> name
                    const machineName = nodeId.replace("machine-", "");
                    const machine = machines.find((m) => m.name === machineName);
                    if (!machine) return;

                    // OLD LOGIC (internal IP):
                    // const machineIps = getMachineIps(machines);
                    // const ip = machineIps[machineName];

                    try {
                      // NEW LOGIC: Fetch runtime IP from Docker
                      // Note: Kathara usually names containers as kathara_<user>_<hash>_<machineName>...
                      // but we can try searching by the image or just pass the machine name
                      // assuming the backend logic locates the correct container (it does ancestor/name lookup).

                      const inspectData = await api.getContainerInspect(machineName);
                      // inspectData is an array [ { ... } ]

                      let ip = "127.0.0.1";

                      if (inspectData && inspectData.length > 0) {
                        const settings = inspectData[0].NetworkSettings;
                        // Determine which network IP to use. 
                        // Usually 'bridge' is the one accessible from host if exposed, 
                        // or the specific kathara network if using a routed setup.
                        // However, Kathara often maps ports to localhost. 

                        // If we want the container IP reachable from host (linux), 
                        // we generally look for the IP in 'bridge' or the main network.
                        // Let's try to find an IPAddress in any network that isn't empty.

                        if (settings.Networks) {
                          const netKeys = Object.keys(settings.Networks);
                          for (const key of netKeys) {
                            const net = settings.Networks[key];
                            if (net.IPAddress) {
                              ip = net.IPAddress;
                              // Prefer 'bridge' if available as it's the default docker network
                              if (key === 'bridge') break;
                            }
                          }
                        }
                      }

                      console.log(`Resolved IP for ${machineName}: ${ip}`);

                      let port = "80"; // Default
                      if (machine.type === "plc") port = "8080";
                      if (machine.type === "scada") port = "1881";

                      const url = `http://${ip}:${port}`;
                      setUiModal({
                        isOpen: true,
                        url,
                        title: `${machineName} (${machine.type})`
                      });
                    } catch (e) {
                      console.error("Failed to resolve container IP", e);
                      // Fallback or alert?
                      if (e.message && (e.message.includes('permission denied') || e.message.includes('docker group'))) {
                        toast.error("Docker permission denied. System fix required (see instructions).");
                      }
                      // For now maybe default to localhost if fail
                      const url = `http://127.0.0.1:8080`; // generic fallback
                      setUiModal({
                        isOpen: true,
                        url,
                        title: `${machineName} (${machine.type}) - (IP Resolve Failed)`
                      });
                    }
                  }}
                  onOpenLogs={(nodeId) => {
                    const machineName = nodeId.replace("machine-", "");
                    setLogsModal({ isOpen: true, containerName: machineName });
                  }}
                />
              </div>
            )}
        </div>
      </div>
      <div className="grid gap-2 items-start">
        {/* Run Simulation */}
        <Button
          isDisabled={simulationRun}
          className="bg-success text-white"
          onClick={async () => {
            setShowSimulationBanner(true);

            try {
              await api.runSimulation(machines, labInfo);
            } catch (e) {
              console.error("Run simulation error:", e);
            }

            setTimeout(() => {
              setShowSimulationBanner(false);
              setSimulationRun(true);
              setStopSimulation(false);
            }, 2000);
          }}
        >
          Run Simulation
        </Button>

        {/* Simulate Attack */}
        <Button
          isDisabled={attackInProgress || !attackLoaded || !simulationRun || stopSimulation}
          className={attackInProgress ? "bg-danger/50 text-white" : "bg-danger text-white"}
          onClick={simulateAttack}
        >
          {attackInProgress ? "Attack launched!" : "Simulate Attack"}
        </Button>

        {/* Stop Simulation */}
        {simulationRun && !stopSimulation && (
          <Button
            size="sm"
            className="bg-warning text-white"
            onClick={handleStopSimulation}
          >
            Stop Simulation
          </Button>
        )}
      </div>
      {showTimer && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-900 text-warning px-6 py-4 rounded-xl shadow-lg w-96 text-center space-y-2">
            <p className="text-sm font-bold uppercase tracking-wide">
              Stand by, Launching attack
            </p>
            <p className="text-xs">Deployment in progress...</p>

            {/* Progress bar */}
            <div className="w-full bg-warning/20 rounded-full h-2 overflow-hidden">
              <div
                className="bg-warning h-2 transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
      {showSimulationBanner && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-900 text-warning px-6 py-4 rounded-xl shadow-lg w-96 text-center space-y-2">
            <p className="text-sm font-bold uppercase tracking-wide">
              Deploying infrastructure
            </p>
            <p className="text-xs">Please wait...</p>

            {/* Progress bar opzionale */}
            <div className="w-full bg-warning/20 rounded-full h-2 overflow-hidden">
              <div
                className="bg-warning h-2 animate-pulse"
                style={{ width: `100%` }}
              />
            </div>
          </div>
        </div>
      )}
      {/* <div className="">
                    <Accordion variant="splitted">
                        <AccordionItem key="1" aria-label="lab-info" title="Controls">
                            <span className="text-foreground text-large" data-open="true">Controls</span>
                            <div className="grid grid-cols-3">
                                <div className="grid gap-2 justify-items-center">
                                    <h1>Edges smoothness</h1>
                                    <Checkbox defaultSelected onValueChange={(value) => setSmoothEnabled({checked: value})}>Enabled</Checkbox>
                                    <Select
                                        label="Type"
                                        className="max-w-xs"
                                        defaultSelectedKeys={["dynamic"]}
                                        onChange={(e) => setSmoothEnabled({value: e.target.value})}
                                    >
                                        <SelectItem key="dynamic">Dynamic</SelectItem>
                                        <SelectItem key="continuous">Continuous</SelectItem>
                                        <SelectItem key="discrete">Discrete</SelectItem>
                                        <SelectItem key="diagonalCross">DiagonalCross</SelectItem>
                                        <SelectItem key="straightCross">StraightCross</SelectItem>
                                        <SelectItem key="horizontal">Horizontal</SelectItem>
                                        <SelectItem key="vertical">Vertical</SelectItem>
                                        <SelectItem key="curvedCW">CurvedCW</SelectItem>
                                        <SelectItem key="curvedCCW">CurvedCCW</SelectItem>
                                        <SelectItem key="cubicBezier">CubicBezier</SelectItem>
                                    </Select>
                                </div>
                                <div className="grid gap-2 justify-items-center">
                                    <h1>Physics</h1>
                                    <Checkbox defaultSelected onValueChange={(value) => setPhysicsEnabled({checked: value})}>Enabled</Checkbox>
                                    <Slider
                                        size="lg"
                                        step={100}
                                        color="foreground"
                                        label="Temperature"
                                        showSteps={true}
                                        maxValue={0}
                                        minValue={-30000}
                                        defaultValue={-1200}
                                        className="max-w-md"
                                    />
                                </div>
                                <div className="grid gap-2 justify-items-center">
                                    <h1>Miscellaneous</h1>
                                    <CheckboxGroup>
                                        <Checkbox value="ifNameAt" onValueChange={(value) => setIfNameAt({checked: value})}>Replace interface name with "@"</Checkbox>
                                        <Checkbox value="ifOspfCost" onValueChange={(value) => setIfOspfCost({checked: value})}>Show OSPF interface cost</Checkbox>
                                        <Checkbox value="routingLabel" onValueChange={(value) => setRoutingLabel({checked: value})}>Show OSPF/RIP/BGP label on router</Checkbox>
                                    </CheckboxGroup>
                                </div>
                            </div>
                        </AccordionItem>
                    </Accordion>
                </div> */}
      <TerminalModal
        isOpen={terminalModalOpen}
        onClose={() => setTerminalModalOpen(false)}
        containerName={terminalNode}
      />
      <UIModal
        isOpen={uiModal.isOpen}
        onClose={() => setUiModal({ ...uiModal, isOpen: false })}
        url={uiModal.url}
        title={uiModal.title}
      />
      <LogsModal
        isOpen={logsModal.isOpen}
        onClose={() => setLogsModal({ ...logsModal, isOpen: false })}
        containerName={logsModal.containerName}
      />
    </div>
  );
}

export default Topology;
