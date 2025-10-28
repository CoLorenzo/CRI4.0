/* eslint-disable prettier/prettier */
export const labInfoModel = {
  description: "",
  version: "",
  author: "",
  email: "",
  web: "",
};

export const backboneModel = {
  name: "",
  row: 1,
  type: "terminal",
  attackLoaded: false,
  attackImage: "",
  attackCommand: "",
  bridged: false,
  targets: [],
  routingSoftware: "frr",
  interfaces: {
    counter: 1,
    if: [
      {
        eth: {
          number: 0,
          domain: "",
        },
        ip: "",
        name: "",
      },
    ],
    free: "",
  },
  gateways: {
    counter: 1,
    gw: [
      {
        gw: "",
        route: "",
        if: 0,
      },
    ],
  },
  pc: {
    dns: "-",
  },
  ws: {
    userdir: false,
  },
  ns: {
    name: "",
    recursion: true,
    authority: true,
  },
  other: {
    image: "",
    files: [],
    fileCounter: 0,
  },

 scripts: {
    startup: "",   // qui metteremo le righe di scripting
  },

  ryu: {
    stp: false,
    rest: true,
    topology: true,
    custom: "",
  },
  tls: {
    in_addr: "0.0.0.0:50000",
    out_addr: "10.0.0.2:50001",
    verify: "0",
  },
  routing: {
    rip: {
      en: false,
      connected: false,
      ospf: false,
      bgp: false,
      network: [""],
      route: [""],
      free: "",
    },
    ospf: {
      en: false,
      connected: false,
      rip: false,
      bgp: false,
      if: [{
          cost: 0,
          interface: null
      }],
      network: [""],
      area: [""],
      stub: [false],
      free: "",
    },
    bgp: {
      en: false,
      as: "",
      network: [""],
      remote: [
        {
          neighbor: "",
          as: "",
          description: "",
        },
      ],
      free: "",
    },
    frr: {
      free: "",
    },
  }
};

export const attacksModel = [
  {
    name: "arp-scanning",
    displayName: "ARP Scanning",
    category: "Reconnaissance",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "/usr/local/bin/arp_scan.sh",
    entrypoint: "sh",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
    
  },
  {
    name: "icmp-scanning",
    displayName: "ICMP Scanning",
    category: "Reconnaissance",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "/usr/local/bin/icmp_scan_scapy.py",
    entrypoint: "python3",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "port-scanning",
    displayName: "Port Scanning",
    category: "Reconnaissance",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "/usr/local/bin/port_scan_scapy.py",
    entrypoint: "python3",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "os-fingerprint",
    displayName: "OS Fingerprinting",
    category: "Reconnaissance",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "/usr/local/bin/os_fingerprint_scapy.py",
    entrypoint: "python3",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "service-enumeration",
    displayName: "Service Enumeration",
    category: "Reconnaissance",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "/usr/local/bin/service_enumeration_scapy.py",
    entrypoint: "python3",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "arp-spoofing",
    displayName: "ARP Spoofing",
    category: "mitm",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "/usr/local/bin/arp_spoofing_scapy.py",
    entrypoint: "python3",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "dns-spoofing",
    displayName: "DNS Spoofing",
    category: "mitm",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "./icmp",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },

  {
    name: "icmp-flood",
    displayName: "ICMP Flood",
    category: "dos",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "syn-flood",
    displayName: "SYN Flood",
    category: "dos",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "udp-flood",
    displayName: "UDP Flood",
    category: "dos",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },

{
    name: "icmp-floodlite",
    displayName: "ICMP Flood lite",
    category: "dos",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "syn-floodlite",
    displayName: "SYN Flood lite",
    category: "dos",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "udp-floodlite",
    displayName: "UDP Flood lite",
    category: "flood",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },

  {
    name: "icmp-ping",
    displayName: "ICMP Ping",
    category: "ping",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "syn-ping",
    displayName: "SYN Ping",
    category: "ping",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "udp-ping",
    displayName: "UDP Ping",
    category: "ping",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },

{
    name: "icmp-pinglite",
    displayName: "ICMP Ping lite",
    category: "ping",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "syn-pinglite",
    displayName: "SYN Ping lite",
    category: "ping",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "udp-pinglite",
    displayName: "UDP Ping lite",
    category: "ping",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "hping3",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  
  {
    name: "modbus-writecoil",
    displayName: "Modbus Write Coil",
    category: "injection",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "modbus-writeregister",
    displayName: "Modbus Write Register",
    category: "injection",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
   {
    name: "packet-sniffing",
    displayName: "Packet Sniffing",
    category: "sniffing",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "modbus-read",
    displayName: "Modbus Read",
    category: "sniffing",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  },
  {
    name: "modbustcp-flood",
    displayName: "Modbus-TCP flood",
    category: "dos",
    attackLoaded: false,
    image: "",
    isImage: false,
    script: "",
    entrypoint: "",
    parameters: {
      argsBeforeTargets: [],    // nessun flag prima degli IP
      argsAfterTargets: []      // nessun flag dopo gli IP
    }
  }
]
