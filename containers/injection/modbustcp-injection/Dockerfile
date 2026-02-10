FROM debian:trixie

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    python3 \
    python3-venv \
    ca-certificates \
    ettercap-text-only \
    jq \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Clone repository
WORKDIR /opt
RUN git clone https://github.com/cybcon/modbus-server

# Setup environment
WORKDIR /opt/modbus-server
RUN uv venv && \
    . .venv/bin/activate && \
    uv pip install -r src/requirements.txt

# Create entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

COPY server_config.json /server_config.json

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]