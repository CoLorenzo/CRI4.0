// src/shared/make-node.js
import AdmZip from "adm-zip";

/** ───────────────── Helpers identici al renderer (adattati a Node) ───────────────── */

function makeMachineFolders(netkit, lab) {
  for (let machine of netkit) lab.folders.push(machine.name);
}

/*function makeStartupFiles(netkit, lab) {
  lab.file["collector.startup"] = "";
  lab.file["collectordb.startup"] = "";
  for (let machine of netkit) {
    //if (machine.name && machine.name !== "") {
      //lab.file[machine.name + ".startup"] = "";
    //}
     const rawName = machine.type === "attacker" ? "attacker" : machine.name;
    const machineName = String(rawName).replace(/[^\w.-]/g, "_");

    // prendi lo script dal nuovo campo, fallback al vecchio
    const userScript =
      (machine.scripts && typeof machine.scripts.startup === "string"
        ? machine.scripts.startup
        : "") ||
      (machine.interfaces && typeof machine.interfaces.free === "string"
        ? machine.interfaces.free
        : "");

    // header sicuro + script utente (trim) + newline finale
    const header = `#!/bin/bash
set -euo pipefail

`;
    const body = (userScript || "").trim();
    lab.file[`${machineName}.startup`] = header + ipSetup + body + "\n";

  }
}*/

function makeStartupFiles(netkit, lab) {
  lab.file["collector.startup"] = "";
  lab.file["collector.startup"] = "";
  lab.file["collectordb.startup"] = "";
  let collectorIpCounter = 1; // New counter for 20.0.0.X subnet
  for (let machine of netkit) {
    const rawName = machine.type === "attacker" ? "attacker" : machine.name;
    const machineName = String(rawName || "node").replace(/[^\w.-]/g, "_");

    // prendi lo script dal nuovo campo, fallback al vecchio
    const userScript =
      (machine.scripts && typeof machine.scripts.startup === "string"
        ? machine.scripts.startup
        : "") ||
      (machine.interfaces && typeof machine.interfaces.free === "string"
        ? machine.interfaces.free
        : "");

    // header sicuro
    let header = "#!/bin/bash\nset -euo pipefail\n\n";
    header += "echo \"nameserver 8.8.8.8\" > /etc/resolv.conf\n";
    let ipSetup = "";

    // Assign IP to eth0 from 20.0.0.0/24 subnet
    let eth0Ip;
    if (machineName === "collector") {
      eth0Ip = "20.0.0.254/24"; // Dedicated IP for the collector
    } else {
      eth0Ip = `20.0.0.${collectorIpCounter}/24`;
      collectorIpCounter++;
    }
    ipSetup += `ip addr add ${eth0Ip} dev eth0\nip link set eth0 up\n`;

    // Assign IPs to eth1 and subsequent interfaces from frontend
    if (machine.interfaces && Array.isArray(machine.interfaces.if)) {
      for (const iface of machine.interfaces.if) {
        if (iface && iface.eth && iface.eth.number >= 1 && typeof iface.ip === "string" && iface.ip.trim() !== "") {
          const interfaceNumber = iface.eth.number;
          let ipAddress = String(iface.ip).trim();
          if (!ipAddress.includes("/")) {
            ipAddress += "/24";
          }
          ipSetup += `ip addr add ${ipAddress} dev eth${interfaceNumber}\nip link set eth${interfaceNumber} up\n`;
        }
      }
    }
    const body = (userScript || "").trim();

    if (machine.type === "tls_termination_proxy") {
      const { in_addr = "0.0.0.0:50000", out_addr = "10.0.0.2:50001", verify = "0" } = machine.tls || {};
      const tlsScript = `
cd /etc/stunnel
mkcert -cert-file server.crt -key-file server.key "localhost" "127.0.0.1" $(hostname -I)

tee /etc/stunnel/stunnel.conf << __EOF__
cert = /etc/stunnel/server.crt
key  = /etc/stunnel/server.key
CAfile = $(mkcert -CAROOT)/rootCA.pem

verify = ${verify}
sslVersion = TLSv1.2
options = NO_SSLv2
options = NO_SSLv3
options = NO_COMPRESSION
pid = /var/run/stunnel.pid
foreground = no

[section]
accept = ${in_addr}
connect = ${out_addr}
__EOF__

stunnel
`;
      lab.file[`${machineName}.startup`] = header + ipSetup + tlsScript;
    } else {
      let extraCommands = "";
      if (machine.type === "engine") {
        // Default values matching engine.py defaults
        let args = "";
        // If properties existed in machine model, we would map them here:
        // if (machine.engine?.temperatureStep) args += ` -t ${machine.engine.temperatureStep}`;

        extraCommands += `uv run /engine.py${args} > /var/log/engine.log 2>&1 & disown\n`;
      }
      lab.file[`${machineName}.startup`] = header + ipSetup + (body ? body + "\n\n" : "") + extraCommands;
    }
  }
}

/* -------------------- LAB CONF -------------------- */

function makeLabInfo(info, lab) {
  if (info) {
    lab.file["lab.conf"] = "";
    if (info.description && info.description !== "")
      lab.file["lab.conf"] += `LAB_DESCRIPTION="${info.description}"\n`;
    if (info.version && info.version !== "")
      lab.file["lab.conf"] += `LAB_VERSION="${info.version}"\n`;
    if (info.author && info.author !== "")
      lab.file["lab.conf"] += `LAB_AUTHOR="${info.author}"\n`;
    if (info.email && info.email !== "")
      lab.file["lab.conf"] += `LAB_EMAIL="${info.email}"\n`;
    if (info.web && info.web !== "")
      lab.file["lab.conf"] += `LAB_WEB="${info.web}"\n`;
    if (lab.file["lab.conf"] !== "") lab.file["lab.conf"] += "\n";
  }
}

function makeLabConfFile(netkit, lab) {
  if (!lab.file["lab.conf"]) lab.file["lab.conf"] = "";

  //lab.file["lab.conf"] += "collector[bridged]=true\n";
  //lab.file["lab.conf"] += 'collector[port]="1337:80"\n';

  //QUESTA NON NA RIMESSA
  // collector[0]=_collector → vedi bug #230, quindi non lo aggiungiamo

  //lab.file["lab.conf"] += "collector[image]=icr/collector\n";
  //lab.file["lab.conf"] += "collectordb[0]=_collector\n";
  //lab.file["lab.conf"] += "collectordb[image]=icr/collector-db\n";

  //PER UNIX POST MAC

  lab.file["lab.conf"] += "collector[bridged]=true\n";
  lab.file["lab.conf"] += 'collector[port]="3100:3100/tcp"\n';
  lab.file["lab.conf"] += 'collector[0]="_collector"\n';
  lab.file["lab.conf"] += "collector[image]=\"icr/collector\"\n";
  lab.file["collector.startup"] += '#!/bin/sh\n'
  lab.file["collector.startup"] += 'echo "nameserver 8.8.8.8" > /etc/resolv.conf\n'
  lab.file["collector.startup"] += 'loki -config.file=/etc/loki/config.yml &\n'
  lab.file["collector.startup"] += 'ip addr add 20.0.0.254/24 dev eth0\n'
  lab.file["collector.startup"] += 'ip link set eth0 up\n'

  // PER BUG MAC

  //lab.file["lab.conf"] += "collector[bridged]=true\n";
  //  lab.file["lab.conf"] += 'collector[port]="3100:3100/tcp"\n';
  //  lab.file["lab.conf"] += "collector[image]=\"icr/collector\"\n";
  //kathara lconfig -n collector --add "_collector"
  //tramite docker exec nel main, lanciare
  //ip addr add 20.0.0.254/24 dev eth1
  //ip link set eth1 up



  //flag sistema operativo mac/Windows workaround linux no 
  //solo prime due righe e quarta
  //quando partito, fare NEL MAIN lconfig .... e poi eseguire all'interno i due comandi ip addr ed ip link

  for (let machine of netkit) {
    // Nome “forzato” e sanificato per evitare slash ecc.
    const rawName =
      machine.type === "attacker" ? "attacker" :
        machine.name || "node";
    const machineName = String(rawName).replace(/[^\w.-]/g, "_");

    for (let machineInterface of machine.interfaces.if) {
      if (machineInterface.eth.number > 0 && machineInterface.eth.domain && machineInterface.eth.domain !== "") {
        lab.file["lab.conf"] += `${machineName}[${machineInterface.eth.number}]=${machineInterface.eth.domain}\n`;
      }
    }
    // aggiunge l'interfaccia _collector come ultima
    const lastIndex = machine.interfaces.if[machine.interfaces.if.length - 1]?.eth?.number ?? -1;
    //lab.file["lab.conf"] += `${machine.name}[${lastIndex + 1}]=_collector\n`;
    lab.file["lab.conf"] += `${machineName}[0]=_collector\n`;
    lab.file["lab.conf"] += `${machineName}[bridged]=true\n`;

    // image per tipo
    if (machine.type == "engine") { lab.file["lab.conf"] += machine.name + "[image]=icr/engine"; }
    if (machine.type == "fan") { lab.file["lab.conf"] += machine.name + "[image]=icr/fan"; }
    if (machine.type == "temperature_sensor") { lab.file["lab.conf"] += machine.name + "[image]=icr/temperature_sensor"; }
    if (machine.type == "tls_termination_proxy") { lab.file["lab.conf"] += machine.name + "[image]=icr/tls_termination_proxy"; }
    if (machine.type == "rejector") { lab.file["lab.conf"] += machine.name + "[image]=icr/rejector"; }
    if (machine.type == "scada") { lab.file["lab.conf"] += machine.name + "[image]=icr/scada"; }
    if (machine.type == "apg") { lab.file["lab.conf"] += machine.name + "[image]=icr/apg"; }
    if (machine.type == "laser") { lab.file["lab.conf"] += machine.name + "[image]=icr/laser"; }
    if (machine.type == "conveyor") { lab.file["lab.conf"] += machine.name + "[image]=icr/conveyor"; }
    if (machine.type == "plc") { lab.file["lab.conf"] += machine.name + "[image]=icr/plc"; }
    if (machine.type == "router") {
      if (machine.routingSoftware == "frr") {
        //lab.file["lab.conf"] += `${machine.name}[image]=kathara/frr`;
        lab.file["lab.conf"] += `${machineName}[image]=kathara/frr`;
      }
      if (machine.routingSoftware == "quagga") {
        //lab.file["lab.conf"] += `${machine.name}[image]=kathara/quagga`;
        lab.file["lab.conf"] += `${machineName}[image]=kathara/quagga`;
      }
    }
    if (machine.type == "terminal" || machine.type == "ws" || machine.type == "ns") {
      //lab.file["lab.conf"] += `${machine.name}[image]=icr/kathara-base`;
      lab.file["lab.conf"] += `${machineName}[image]=icr/kathara-base`;
    }
    if (machine.type == "ngfw") {
      lab.file["lab.conf"] += `${machineName}[image]=ngfw_appliance`;
    }
    if (machine.type == "attacker") {
      if (machine.attackLoaded && machine.attackImage != "") {
        //lab.file["lab.conf"] += `${machine.name}[image]=${machine.attackImage}`;
        lab.file["lab.conf"] += `${machineName}[image]=${machine.attackImage}`;
      } else {
        //lab.file["lab.conf"] += `${machine.name}[image]=kalilinux/kali-rolling`;
        lab.file["lab.conf"] += `${machineName}[image]=kalilinux/kali-rolling@sha256:eb500810d9d44236e975291205bfd45e9e19b7f63859e3a72ba30ea548ddb1df`;

      }
    }
    lab.file["lab.conf"] += "\n";

    // Set ENDPOINT environment variable for industrial devices (fan, temperature_sensor)
    if (machine.type === "fan" || machine.type === "temperature_sensor") {
      let endpoint = "http://localhost:8000/";

      // If an engine is selected, find its IP address
      if (machine.industrial && machine.industrial.selectedEngineId) {
        const selectedEngine = netkit.find(m => m.id === machine.industrial.selectedEngineId);
        if (selectedEngine && selectedEngine.interfaces && selectedEngine.interfaces.if && selectedEngine.interfaces.if[0]) {
          const engineIp = selectedEngine.interfaces.if[0].ip;
          if (engineIp) {
            // Remove the subnet mask (e.g., "192.168.1.1/24" -> "192.168.1.1")
            const ipWithoutMask = engineIp.split("/")[0];
            endpoint = `http://${ipWithoutMask}:8000/`;
          }
        }
      }

      // Set the ENDPOINT environment variable in lab.conf
      lab.file["lab.conf"] += `${machineName}[env]="ENDPOINT=${endpoint}"\n`;
    }
  }
}

/** ───────────────── Normalizzatore d’aiuto (se serve) ─────────────────
 * Se dal renderer arrivasse un formato semplificato, convertiamolo
 * in quello atteso da make.jsx: interfaces.if -> [{eth:{number,domain}}...]
 */
export function toNetkitFormat(machines) {
  // Se ha già interfaces.if con eth.number → lascio stare
  if (Array.isArray(machines) && machines[0]?.interfaces?.if?.[0]?.eth?.number !== undefined) {
    return machines.map(m => {
      const updatedInterfaces = m.interfaces.if.map((iface, idx) => ({
        ...iface,
        eth: { ...iface.eth, number: idx + 1 } // Adjust eth.number here
      }));

      const copy = {
        ...m,
        interfaces: { ...m.interfaces, if: updatedInterfaces }
      };

      if (copy.type === "attacker") {
        copy.name = "attacker";
      }
      return copy;
    });
  }

  // Se ha interfaces come lista ["A","B"] → converto
  const convertIfList = (ifs) =>
    (ifs || []).map((iface, idx) => ({
      eth: { number: idx + 1, domain: iface.domain }, // Increment idx by 1
      ip: iface.ip // Capture the IP here
    }));

  return (machines || []).map((m) => {
    const copy = {
      ...m,
      interfaces: m.interfaces?.if
        ? m.interfaces
        : { if: Array.isArray(m.interfaces) ? convertIfList(m.interfaces) : [] },
    };

    // 👇 Forziamo il nome se è un attacker
    if (copy.type === "attacker") {
      copy.name = "attacker";
    }

    return copy;
  });
}

/** ───────────────── Funzione principale: genera ZIP in outPath ───────────────── */
export async function generateZipNode(machines, labInfo, outPath) {
  const netkit = toNetkitFormat(machines);

  // 🟢 Log per controllare cosa arriva
  const attackers = (netkit || []).filter(m => m.type === "attacker");
  console.log("🧪 attackers in input:", attackers.map(a => ({
    name: a.name,
    attackImage: a.attackImage,
    type: a.type
  })));

  // lab “virtuale” come nel renderer
  const lab = { file: {}, folders: [] };

  makeMachineFolders(netkit, lab);
  makeStartupFiles(netkit, lab);
  makeLabInfo(labInfo, lab);
  makeLabConfFile(netkit, lab);

  // costruzione ZIP
  const zip = new AdmZip();

  // cartelle (vuote) per ogni macchina
  for (const folder of lab.folders) {
    // AdmZip aggiunge file; per cartelle possiamo aggiungere un file placeholder opzionale
    // ma Kathara non lo richiede: i file .startup stanno in root del lab
  }

  // file in root
  for (const [name, content] of Object.entries(lab.file)) {
    zip.addFile(name, Buffer.from(content ?? "", "utf8"));
  }

  // scrivi su disco
  zip.writeZip(outPath);
}
