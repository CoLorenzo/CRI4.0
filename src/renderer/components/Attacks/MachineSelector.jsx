/* eslint-disable react/no-array-index-key */
/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { Card, CardBody, CheckboxGroup, Checkbox, RadioGroup, Radio } from "@nextui-org/react";
import { useState } from "react";

function MachineSelector({ machines, attacker, setTargets, view, onViewChange }) {
  const [internalView, setInternalView] = useState("same"); // "same" | "others"

  const currentView = view !== undefined ? view : internalView;

  const handleViewChange = (val) => {
    if (onViewChange) {
      onViewChange(val);
    } else {
      setInternalView(val);
    }
  };

  const hasSameDomain = (m1, m2) => {
    const m1Domains = m1.interfaces.if.map((i) => i.eth.domain);
    const m2Domains = m2.interfaces.if.map((i) => i.eth.domain);
    return m1Domains.some((d) => m2Domains.includes(d));
  };

  const selectedKeys = attacker.targets ? attacker.targets.map((t) => t.name) : [];

  const handleSelectionChange = (keys) => {
    const selectedMachines = machines.filter((m) => keys.includes(m.name));
    setTargets(selectedMachines);
  };

  return (
    <Card>
      <CardBody>
        {/* Toggle bello pulito in alto */}
        <RadioGroup
          orientation="horizontal"
          label="Select target group"
          value={currentView}
          onValueChange={handleViewChange}
          className="mb-2"
        >
          <Radio value="same">Machines in same subnet</Radio>
          <Radio value="others">All other machines</Radio>
        </RadioGroup>

        {/* Mostra SOLO il gruppo scelto */}
        {currentView === "same" && (
          <CheckboxGroup
            value={selectedKeys}
            onValueChange={handleSelectionChange}
            orientation="horizontal"
            label="Select targets in the same subnet"
          >
            {machines.map((m, index) =>
              m.type !== "attacker" && hasSameDomain(attacker, m) && (
                <div key={index} className="grid grid-cols-2">
                  <Checkbox value={m.name}>{m.name}</Checkbox>
                </div>
              )
            )}
          </CheckboxGroup>
        )}

        {currentView === "others" && (
          <CheckboxGroup
            value={selectedKeys}
            onValueChange={handleSelectionChange}
            orientation="horizontal"
            label="Select other targets"
          >
            {machines.map((m, index) =>
              m.type !== "attacker" && !hasSameDomain(attacker, m) && (
                <div key={index} className="grid grid-cols-2">
                  <Checkbox value={m.name}>{m.name}</Checkbox>
                </div>
              )
            )}
          </CheckboxGroup>
        )}
      </CardBody>
    </Card>
  );
}

export default MachineSelector;