#!/bin/bash

# Write environment variables to files
if [ -n "$USERNAMES" ]; then
    echo "$USERNAMES" > /opt/openplc-crack/usernames.txt
fi

if [ -n "$PASSWORDS" ]; then
    echo "$PASSWORDS" > /opt/openplc-crack/passwords.txt
fi

if [ -z "$TARGET" ]; then
    echo "Warning: TARGET environment variable is not set. Starting in idle mode."
    
    # Execute Kathara startup script if it exists to configure networking
    for f in /*.startup; do
        if [ -f "$f" ]; then
            echo "Executing startup script: $f"
            chmod +x "$f"
            "$f"
        fi
    done

    # Start Fluent Bit in background to be ready
    fluent-bit -c /root/fluent-bit.conf &
    # Keep container alive for manual exec
    tail -f /dev/null
    exit 0
fi

# Start Fluent Bit in background
fluent-bit -c /root/fluent-bit.conf &

# Ensure results.log exists and is empty
: > /opt/openplc-crack/results.log

# Change directory to ensure run.sh finds local files (fixes grep: login.html error)
cd /opt/openplc-crack

# Run the attack
# Output to stderr (for docker logs) AND filter for SUCCESS to results.log (for Fluent Bit)
# We use stdbuf to avoid buffering delays if available, otherwise just standard pipe

echo "Starting OpenPLC/Crack on target: $TARGET"
./run.sh "http://$TARGET:8080" 2>&1 | tee /dev/stderr >> results.log

# Keep container running after attack to allow log collection
tail -f /dev/null
