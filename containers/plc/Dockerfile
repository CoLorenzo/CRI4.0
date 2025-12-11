FROM debian:trixie

# Install docker-systemctl-replacement
ENV PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin
RUN apt update && \
    apt install -y pipx && \
    pipx install docker-systemctl-replacement && \
    pipx ensurepath && \
    ln -s /root/.local/bin/systemctl.py /usr/local/bin/systemctl

#install OpenPLCv3
RUN apt update && \
    apt install -y git sudo && \
    git clone https://github.com/thiagoralves/OpenPLC_v3.git /opt/OpenPLC_v3 && \
    git checkout 9c246ca23651c6d1e64552e387221d873cf0a0ce \
    cd /opt/OpenPLC_v3 && \
    ./install.sh linux

#install OpenPLC-CLI
RUN apt update && \
    apt install -y pipx && \
    pipx install git+https://github.com/CoLorenzo/openplc-cli.git@2c9e81617a86b5402c79f9ba15ff5eb0e45bd9f8

#install iproute2
RUN apt update && apt install -y iproute2

#install supervisord
RUN apt update && apt install -y supervisor
COPY ./supervisord.conf /etc/supervisor/supervisord.conf
