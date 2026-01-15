FROM debian:trixie
SHELL ["/bin/bash", "-lc"]
ENV DEBIAN_FRONTEND=noninteractive

#install node v22.21.0
ENV NVM_DIR=/root/.nvm
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg uuid-runtime \
 && rm -rf /var/lib/apt/lists/* \
 && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash \
 && source "$NVM_DIR/nvm.sh" \
 && nvm install v25.3.0 \
 && nvm use v25.3.0 \
 && ln -sf "$NVM_DIR/versions/node/$(nvm current)/bin/"{node,npm,npx} /usr/local/bin/

#install fuxa
RUN apt-get update && \
    apt-get install -y curl jq iproute2&& \
    npm install -g --unsafe-perm @frangoteam/fuxa

