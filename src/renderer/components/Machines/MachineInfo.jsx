/* eslint-disable no-else-return */
/* eslint-disable react/prop-types */
/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { useState, useEffect } from "react";
import { RadioGroup, Radio } from "@nextui-org/radio";
import { Input } from "@nextui-org/input";
import { Accordion, AccordionItem } from "@nextui-org/react";

function generateCustomStartupScript(machine) {
    let script = "#!/bin/sh\n\n";
    script += "echo 'nameserver 8.8.8.8' > /etc/resolv.conf 2>/dev/null || true\n";
    script += "ip addr add <eth0_ip> dev eth0 2>/dev/null || true\n";
    script += "ip link set eth0 up 2>/dev/null || true\n";
    for (const iface of (machine.interfaces?.if || [])) {
        if (iface.ip && iface.ip !== '' && iface.eth?.number >= 1) {
            const ip = String(iface.ip).trim().includes('/') ? iface.ip.trim() : iface.ip.trim() + '/24';
            script += `ip addr add ${ip} dev eth${iface.eth.number} 2>/dev/null || true\n`;
            script += `ip link set eth${iface.eth.number} up 2>/dev/null || true\n`;
        }
    }
    script += "\nexport PATH=\"$HOME/.local/bin:$HOME/.cargo/bin:$PATH\"\n";
    script += "smoloki -b http://10.1.0.254:3100 '{\"job\":\"test\",\"level\":\"info\",\"host\":\"'\"$(hostname)\"'\"}' '{\"message\":\"ready\"}' 2>/dev/null || true\n";
    return script;
}

export function MachineInfo({ id, machine, machines, setMachines, customTemplates, customAttackTemplates }) {
  function handleChange(value, data) {
    setMachines(() =>
      machines.map((m) => {
        if (m.id === machine.id) {
          return data;
        } else {
          return m;
        }
      })
    );
  }

  function handleTypeChange(value) {
    handleChange(value, { ...machine, type: value, customTemplateId: null, customAttackId: null });
  }

  const attackerExistsElsewhere = machines.some(
    (m) => m.type === "attacker" && m.id !== machine.id
  );

  const exactlyOneOtherController =
    machines.filter((m) => m.type === "controller" && m.id !== machine.id).length === 1;

  const templates = customTemplates || [];
  const attackTemplates = customAttackTemplates || [];

  return (
    <div className="h-full">
      <div className="grid content-start gap-2">
        <div>
          <Input
            type="text"
            variant="underlined"
            placeholder={`pc${id}`}
            value={machine.name}
            onValueChange={(value) =>
              handleChange(value, {
                ...machine,
                name: value.toLocaleLowerCase(),
              })
            }
          />
        </div>

        <div className="row-span-7">
          <Accordion
            selectionMode="multiple"
            className="mt-2"
          >
            {/* GENERAL */}
            <AccordionItem key="general" aria-label="General" title="General">
              <RadioGroup
                color="primary"
                value={(machine.customTemplateId || machine.customAttackId) ? "" : machine.type}
                onValueChange={handleTypeChange}
              >
                <Radio value="terminal">Terminal</Radio>
                <Radio value="router">Router</Radio>
                <Radio value="ws">Web Server</Radio>
                <Radio value="ns">Name Server</Radio>
              </RadioGroup>
            </AccordionItem>

            {/* ATTACK */}
            <AccordionItem key="attack" aria-label="Attack" title="Attack">
              <RadioGroup
                color="primary"
                value={(machine.customTemplateId || machine.customAttackId) ? "" : machine.type}
                onValueChange={handleTypeChange}
              >
                <Radio isDisabled={attackerExistsElsewhere} value="attacker">
                  Attacker
                </Radio>
              </RadioGroup>
              {attackTemplates.length > 0 && (
                <RadioGroup
                  color="secondary"
                  value={machine.customAttackId || ""}
                  onValueChange={(attackId) => {
                    const tpl = attackTemplates.find(t => t.id === attackId);
                    if (!tpl) return;
                    const manifest = tpl.manifest || {};
                    handleChange(attackId, {
                      ...machine,
                      type: "attacker",
                      customAttackId: attackId,
                      customTemplateId: null,
                      attacker: {
                        image: tpl.image,
                        fields: (manifest.fields || []).map(f => ({ ...f })),
                        dockerFlags: (manifest.dockerFlags || []).map(f => ({ ...f })),
                        logo: tpl.logo || "",
                      },
                    });
                  }}
                  className="mt-2"
                >
                  {attackTemplates.map((tpl) => (
                    <Radio key={tpl.id} value={tpl.id}>{tpl.name}</Radio>
                  ))}
                </RadioGroup>
              )}
            </AccordionItem>

            {/* DEFENSE */}
            <AccordionItem key="defense" aria-label="Defense" title="Defense">
              <RadioGroup
                color="primary"
                value={(machine.customTemplateId || machine.customAttackId) ? "" : machine.type}
                onValueChange={handleTypeChange}
              >
                <Radio value="ngfw">NGFW Appliance</Radio>
                <Radio value="tls_termination_proxy">TLS termination proxy</Radio>
              </RadioGroup>
            </AccordionItem>

            {/* INDUSTRIAL */}
            <AccordionItem key="industrial" aria-label="Industrial" title="Industrial">
              <RadioGroup
                color="primary"
                value={(machine.customTemplateId || machine.customAttackId) ? "" : machine.type}
                onValueChange={handleTypeChange}
              >
                <Radio value="engine">Engine</Radio>
                <Radio value="fan">Fan</Radio>
                <Radio value="temperature_sensor">Temperature sensor</Radio>
                <Radio value="rejector">Rejector</Radio>
                <Radio value="scada">Scada controller</Radio>
                <Radio value="apg">Abstract piece generator</Radio>
                <Radio value="laser">Laser sensor</Radio>
                <Radio value="conveyor">Conveyor</Radio>
                <Radio value="plc">PLC</Radio>
              </RadioGroup>
            </AccordionItem>

            {/* OTHER */}
            <AccordionItem key="other" aria-label="Other" title="Other">
              <RadioGroup
                color="primary"
                value={(machine.customTemplateId || machine.customAttackId) ? "" : machine.type}
                onValueChange={handleTypeChange}
              >
                {exactlyOneOtherController ? (
                  <Radio value="switch">Open vSwitch</Radio>
                ) : (
                  <Radio value="controller">OpenFlow Ryu Controller</Radio>
                )}
                <Radio value="other">Other</Radio>
              </RadioGroup>
            </AccordionItem>

            {/* CUSTOM */}
            <AccordionItem key="custom" aria-label="Custom" title="Custom">
              {templates.length === 0 ? (
                <p className="text-xs text-default-400 pb-2">
                  No custom machines yet. Use &ldquo;Create Machine&rdquo; to define one.
                </p>
              ) : (
                <RadioGroup
                  color="secondary"
                  value={machine.customTemplateId || ""}
                  onValueChange={(templateId) => {
                    const tpl = templates.find(t => t.id === templateId);
                    if (!tpl) return;
                    const manifest = tpl.manifest || {};
                    const updated = {
                      ...machine,
                      type: "other",
                      customTemplateId: templateId,
                      other: {
                        ...machine.other,
                        image: tpl.image,
                        fields: (manifest.fields || []).map(f => ({ ...f })),
                        dockerFlags: (manifest.dockerFlags || []).map(f => ({ ...f })),
                        logo: tpl.logo || "",
                      },
                    };
                    handleChange(templateId, {
                      ...updated,
                      scripts: { ...(updated.scripts || {}), startup: generateCustomStartupScript(updated) },
                    });
                  }}
                >
                  {templates.map((tpl) => (
                    <Radio key={tpl.id} value={tpl.id}>{tpl.name}</Radio>
                  ))}
                </RadioGroup>
              )}
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}
