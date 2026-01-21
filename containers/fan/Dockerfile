FROM debian:trixie

RUN apt-get update && apt-get install -y iproute2

#Install UV
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"
RUN uv venv

COPY requirements.txt /requirements.txt
RUN uv pip install -r requirements.txt
COPY fan.py /fan.py
RUN chmod +x /fan.py

CMD ["uv", "run", "/fan.py"]
