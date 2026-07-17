#!/bin/sh
# Launches the physics simulation and one peripheral process per device
# config file found in the scenario directory.
#
# The scenario directory defaults to /scenario. User-provided configs are
# copied there by the Kathara startup script; if the directory is missing
# or lacks the main configs, the defaults baked into the image are used.

SCENARIO_DIR="${SCENARIO_DIR:-/scenario}"
DEFAULTS_DIR="/scenario-defaults"

mkdir -p "$SCENARIO_DIR"

# Fall back to the default scenario if the user did not provide one
for MAIN in simulation.json gateway.json visualization.json; do
    if [ ! -f "$SCENARIO_DIR/$MAIN" ]; then
        cp "$DEFAULTS_DIR/$MAIN" "$SCENARIO_DIR/$MAIN"
    fi
done

# If no device config was provided, use the default peripherals too
HAS_DEVICE=0
for f in "$SCENARIO_DIR"/*.json; do
    case "$(basename "$f")" in
        simulation.json|gateway.json|visualization.json) continue ;;
        *) HAS_DEVICE=1 ;;
    esac
done
if [ "$HAS_DEVICE" -eq 0 ]; then
    for f in "$DEFAULTS_DIR"/*.json; do
        case "$(basename "$f")" in
            simulation.json|gateway.json|visualization.json) continue ;;
            *) cp "$f" "$SCENARIO_DIR/" ;;
        esac
    done
fi

echo "[device] starting physics-sim"
physics-sim \
    --sim-cfg "$SCENARIO_DIR/simulation.json" \
    --net-cfg "$SCENARIO_DIR/gateway.json" \
    --vis-cfg "$SCENARIO_DIR/visualization.json" &

sleep 1

# Launch the matching peripheral binary for every device config file
for DEVICE_FILE in "$SCENARIO_DIR"/*.json; do
    BASENAME=$(basename "$DEVICE_FILE")
    case "$BASENAME" in
        simulation.json|gateway.json|visualization.json) continue ;;
    esac

    DEVICE_TYPE=$(jq -r '.device_type' "$DEVICE_FILE")

    case "$DEVICE_TYPE" in
        TempSensor)     BIN="temp-sensor" ;;
        ValveActuator)  BIN="valve-actuator" ;;
        HydraulicLine|ThermalTank)
            # No dedicated driver yet: these device types are simulated by
            # physics-sim itself and exposed through the generic peripherals.
            echo "[device] SKIP $BASENAME: no driver for '$DEVICE_TYPE'"
            continue
            ;;
        *)
            echo "[device] SKIP $BASENAME: unknown device_type '$DEVICE_TYPE'"
            continue
            ;;
    esac

    echo "[device] launching $BIN --config $DEVICE_FILE"
    "$BIN" --config "$DEVICE_FILE" &
done

wait
