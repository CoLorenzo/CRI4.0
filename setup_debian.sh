#! /bin/bash

# install nvm if is not present
if ! command -v nvm >/dev/null 2>&1; then
	sudo apt update
	sudo apt install -y curl
	curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
	source ~/.bashrc
fi
nvm install 18
nvm use 18

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
sudo apt install -y git build-essential
git clone -b webui --depth 1 https://github.com/CoLorenzo/CRI4.0.git
cd CRI4.0
npm install
npm run build:dll
cd containers
