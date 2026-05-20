/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import React, { useState, useContext } from "react";
import { Card, CardBody } from "@nextui-org/react";
import { Button } from "@nextui-org/react";
import { Input, Select, SelectItem, Switch } from "@nextui-org/react";
import { XSymbol } from "../Symbols/XSymbol";
import MachineSelector from "./MachineSelector";
import { NotificationContext } from "../../contexts/NotificationContext";


function FieldInputs({ fields, onFieldChange, isReadOnly }) {
  if (fields.length === 0) return null;
  return (
    <div className="grid gap-3 mb-4">
      {fields.map((field) => {
        if (field.type === "textbox") {
          return (
            <Input
              key={field.id}
              label={field.key}
              value={field.value || ""}
              onValueChange={(v) => onFieldChange(field.id, v)}
              size="sm"
              variant="flat"
              isReadOnly={isReadOnly}
            />
          );
        }
        if (field.type === "spinbox") {
          const isFloat = (field.numericKind || "integer") === "float";
          const precision = field.precision || 2;
          const step = isFloat ? Math.pow(10, -precision).toFixed(precision) : "1";
          return (
            <Input
              key={field.id}
              label={field.key}
              type="number"
              step={step}
              value={field.value || "0"}
              onValueChange={(v) => onFieldChange(field.id, v)}
              size="sm"
              variant="flat"
              isReadOnly={isReadOnly}
            />
          );
        }
        if (field.type === "checkbox") {
          return (
            <div key={field.id} className="flex items-center gap-3">
              <span className="text-sm text-default-700">{field.key}</span>
              <Switch
                size="sm"
                isSelected={field.value === "true"}
                isDisabled={isReadOnly}
                onValueChange={(v) => onFieldChange(field.id, v ? "true" : "false")}
              />
              <span className="text-xs text-default-400">{field.value === "true" ? "true" : "false"}</span>
            </div>
          );
        }
        if (field.type === "dropdown") {
          return (
            <Select
              key={field.id}
              label={field.key}
              selectedKeys={field.value ? new Set([field.value]) : new Set()}
              onSelectionChange={(keys) => onFieldChange(field.id, Array.from(keys)[0] || "")}
              size="sm"
              isDisabled={isReadOnly}
            >
              {(field.entries || []).filter(e => e).map(entry => (
                <SelectItem key={entry}>{entry}</SelectItem>
              ))}
            </Select>
          );
        }
        return null;
      })}
    </div>
  );
}

function CustomAttacks({ attacker, machines, setMachines }) {
  const [customAttackTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem("customAttacks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const isLoaded = !!attacker?.customAttackId;
  const loadedId = attacker?.customAttackId || "";

  const [expandedId, setExpandedId] = useState(loadedId || "");
  const [selectedId, setSelectedId] = useState(loadedId || "");
  const [fields, setFields] = useState(() => {
    if (isLoaded && attacker?.attacker?.fields?.length > 0) {
      return attacker.attacker.fields.map(f => ({ ...f }));
    }
    const tpl = customAttackTemplates.find(t => t.id === (loadedId || customAttackTemplates[0]?.id));
    return ((tpl?.manifest || {}).fields || []).map(f => ({ ...f }));
  });
  const [targets, setTargets] = useState(attacker?.targets || []);

  const { setAttackLoaded } = useContext(NotificationContext);

  const updateMachineData = (updates) => {
    setMachines(prev => prev.map(m => m.type === "attacker" ? { ...m, ...updates } : m));
  };

  const handleTargetsChange = (val) => {
    setTargets(val);
    updateMachineData({ targets: val });
  };

  const handleFieldChange = (fieldId, value) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, value } : f));
  };

  const handleRowClick = (id) => {
    if (isLoaded) {
      if (loadedId === id) setExpandedId(prev => prev === id ? "" : id);
      return;
    }
    if (expandedId === id) {
      setExpandedId("");
    } else {
      setSelectedId(id);
      setExpandedId(id);
      const tpl = customAttackTemplates.find(t => t.id === id);
      if (tpl) {
        setFields(((tpl.manifest || {}).fields || []).map(f => ({ ...f })));
      }
    }
  };

  const toggleAttack = () => {
    if (isLoaded) {
      updateMachineData({
        customAttackId: null,
        attackLoaded: false,
        attackImage: "",
        attackCommand: "",
        attackCommandArgs: [],
        attacker: { image: "", fields: [], dockerFlags: [], logo: "" },
      });
      setAttackLoaded(false);
      return;
    }
    const tpl = customAttackTemplates.find(t => t.id === selectedId);
    if (!tpl) return;
    const manifest = tpl.manifest || {};
    updateMachineData({
      customAttackId: tpl.id,
      attackLoaded: true,
      attackImage: tpl.image,
      attackCommand: "",
      attackCommandArgs: [],
      attacker: {
        image: tpl.image,
        fields: fields.map(f => ({ ...f })),
        dockerFlags: (manifest.dockerFlags || []).map(f => ({ ...f })),
        logo: tpl.logo || "",
      },
      targets: targets,
    });
    setAttackLoaded(true);
  };

  if (customAttackTemplates.length === 0) {
    return (
      <Card>
        <CardBody className="grid place-items-center py-8">
          <p className="text-default-400 text-sm">
            No custom attacks defined. Use &ldquo;Create Machine&rdquo; in Settings to define one.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Card>
        <CardBody className="p-0 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-divider">
                <th className="text-left px-4 py-2 text-xs font-semibold text-default-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-default-500 uppercase tracking-wider">Image</th>
              </tr>
            </thead>
            <tbody>
              {customAttackTemplates.map((tpl) => {
                const isSelected = isLoaded ? loadedId === tpl.id : selectedId === tpl.id;
                const isExpanded = expandedId === tpl.id;
                const isOtherLoaded = isLoaded && loadedId !== tpl.id;
                const visibleFields = isLoaded && loadedId === tpl.id
                  ? (attacker?.attacker?.fields || [])
                  : fields;
                return (
                  <React.Fragment key={tpl.id}>
                    <tr
                      className="border-b border-divider transition-colors"
                      style={{
                        backgroundColor: isSelected ? "#BE2222" : undefined,
                        cursor: isOtherLoaded ? "default" : "pointer",
                        opacity: isOtherLoaded ? 0.4 : 1,
                      }}
                      onClick={() => handleRowClick(tpl.id)}
                    >
                      <td className="px-4 py-3 text-sm font-medium">{tpl.name}</td>
                      <td className="px-4 py-3 text-xs text-default-400 font-mono">{tpl.image}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={2} className="px-4 py-4 bg-default-50 border-b border-divider">
                          {attacker && (
                            <div className={`mb-4 ${isLoaded ? "opacity-50 pointer-events-none" : ""}`}>
                              <MachineSelector
                                machines={machines}
                                attacker={attacker}
                                setTargets={handleTargetsChange}
                              />
                            </div>
                          )}
                          <FieldInputs
                            fields={visibleFields}
                            onFieldChange={handleFieldChange}
                            isReadOnly={isLoaded}
                          />
                          <Button
                            color={isLoaded ? "primary" : "success"}
                            startContent={isLoaded ? <XSymbol /> : null}
                            isDisabled={!attacker}
                            onClick={toggleAttack}
                          >
                            {isLoaded ? "Unload Attack" : "Load Attack"}
                          </Button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

export default CustomAttacks;
