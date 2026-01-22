#!/bin/bash

# Get endpoint from environment variable, default to localhost
ENDPOINT="${ENDPOINT:-http://localhost:8000/}"

# Run the temperature sensor with the endpoint
exec uv run /tsens.py -e "$ENDPOINT"
