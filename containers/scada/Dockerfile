FROM frangoteam/fuxa:latest

RUN apt update && apt install -y iproute2

#Install UV
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"
RUN uv venv

COPY fuxa_save_editor /root/fuxa_save_editor
RUN cd /root/fuxa_save_editor && uv tool install ./