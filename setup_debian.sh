#! /bin/bash

# install nvm if is not present
if ! command -v nvm >/dev/null 2>&1; then
	sudo apt update
	sudo apt install -y curl
	curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
	source ~/.bashrc
fi
nvm install 25.3.0
nvm use 25.3.0

#Install docker if not exists
if ! command -v docker >/dev/null 2>&1; then
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
 https://download.docker.com/linux/debian \
 $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
 | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

#install kathara if not present
if ! command -v kathara >/dev/null 2>&1; then
sudo apt update
sudo apt install -y wget apparmor tmux
	wget https://launchpad.net/~katharaframework/+archive/ubuntu/kathara/+files/kathara_3.8.0-1noble_amd64.deb -O kathara.deb
	sudo apt install -y ./kathara.deb
	rm kathara.deb
	kathara check
	#use Tmux as terminal
	sed -i 's|"terminal": *"[^"]*"|"terminal": "TMUX"|' ~/.config/kathara.conf
fi

# Install ICR
sudo apt update
sudo apt install -y git build-essential python3 python3-pip python3-setuptools python-is-python3



# Setup in current directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Install dependencies and build
npm install
npm run build:dll

cd containers
sudo docker compose --profile collector --profile kathara build
cd ..

# Ensure run_webui.sh is executable
chmod +x "$DIR/run_webui.sh"

# Determine variables for service creation
CURRENT_USER=$(whoami)
NODE_BIN=$(dirname $(which node))

# Create systemd service for ICR
cat <<EOF | sudo tee /etc/systemd/system/icr.service
[Unit]
Description=ICR
After=network.target

[Service]
User=$CURRENT_USER
WorkingDirectory=$DIR
ExecStart=$DIR/run_webui.sh
Environment="PATH=$NODE_BIN:/usr/local/bin:/usr/bin:/bin"
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now icr.service