FROM kalilinux/kali-rolling

# Update and install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gpg \
    git \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Fluent Bit
RUN curl -fsSL https://packages.fluentbit.io/fluentbit.key | gpg --dearmor -o /usr/share/keyrings/fluentbit-keyring.gpg && \
    echo 'deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/debian/bookworm bookworm main' | tee /etc/apt/sources.list.d/fluent-bit.list && \
    apt-get update && apt-get install -y fluent-bit

# Setup Fluent Bit link and directories
RUN ln -s /opt/fluent-bit/bin/fluent-bit /usr/local/bin/fluent-bit && \
    mkdir -p /var/lib/fluent-bit && \
    chown root:root /var/lib/fluent-bit

# Clone OpenPLC Crack
WORKDIR /opt
RUN git clone https://github.com/CoLorenzo/openplc-crack && \
    cd openplc-crack

# Copy configuration files
COPY entrypoint.sh /usr/local/bin/
COPY fluent-bit.conf /root/

RUN chmod +x /usr/local/bin/entrypoint.sh && \
    chmod +x /opt/openplc-crack/run.sh

#TODO: move above
RUN apt update && apt install -y iproute2

WORKDIR /opt/openplc-crack
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
