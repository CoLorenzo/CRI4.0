#! /bin/bash

# Ensure the script is run with sudo for permission-sensitive operations,
# but we need to know the real user for file ownership and home directory access.

if [ "$EUID" -eq 0 ]; then
    if [ -n "$SUDO_USER" ]; then
        REAL_USER="$SUDO_USER"
        REAL_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    else
        echo "Error: Please run this script with sudo so permissions can be set, but do not run as root directly."
        echo "Usage: sudo ./setup_debian.sh"
        exit 1
    fi
else
   # If not running as root, we will need sudo later.
   # But better to enforce sudo execution to keep things simple or ask for sudo password early.
    echo "Please run with sudo: sudo ./setup_debian.sh"
    exit 1
fi

echo "Running setup for user: $REAL_USER (Home: $REAL_HOME)"

# Function to run command as the real user
run_as_user() {
    sudo -u "$REAL_USER" bash -c "$1"
}

# --- NVM Setup ---
# NVM is usually installed in the user's home.
export NVM_DIR="$REAL_HOME/.nvm"

# install nvm if is not present for the REAL_USER
if ! run_as_user "[ -s \"$NVM_DIR/nvm.sh\" ]"; then
    echo "Installing NVM..."
    sudo apt update
    sudo apt install -y curl
    run_as_user "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
fi

# Load NVM
# We need to source it in the current shell to use nvm, but since we are root,
# we might need to rely on run_as_user for nvm commands or source it locally if safe.
# Simpler approach: Use run_as_user to install node.
echo "Installing Node 25.3.0..."
run_as_user ". \"$NVM_DIR/nvm.sh\" && nvm install 25.3.0 && nvm use 25.3.0 && nvm alias default 25.3.0"

# --- Docker Setup ---
if ! command -v docker >/dev/null 2>&1; then
    echo "Installing Docker..."
    sudo apt update
    sudo apt install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -yes -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
     https://download.docker.com/linux/debian \
     $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
     | sudo tee /etc/apt/sources.list.d/docker.list
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker "$REAL_USER"
fi

# --- Kathara Setup ---
if ! command -v kathara >/dev/null 2>&1; then
    echo "Installing Kathara..."
    sudo apt update
    sudo apt install -y wget apparmor tmux
    wget https://launchpad.net/~katharaframework/+archive/ubuntu/kathara/+files/kathara_3.8.0-1noble_amd64.deb -O kathara.deb
    sudo apt install -y ./kathara.deb
    rm kathara.deb
    
    # Run kathara check as user (might need to log out/in for docker group, so this might fail if docker was just installed)
    # create config for user
    run_as_user "mkdir -p ~/.config"
    run_as_user "kathara check || true" 
    # use Tmux as terminal
    # Check if file exists first
    if [ -f "$REAL_HOME/.config/kathara.conf" ]; then
        sudo sed -i 's|"terminal": *"[^"]*"|"terminal": "TMUX"|' "$REAL_HOME/.config/kathara.conf"
    fi
fi

# --- ICR Installation ---
echo "Installing ICR dependencies..."
sudo apt update
sudo apt install -y git build-essential python3 python3-pip python3-setuptools python-is-python3

# Setup installation directory
INSTALL_DIR="/opt/icr"

echo "Setting up $INSTALL_DIR..."
if [ ! -d "$INSTALL_DIR" ]; then
    sudo mkdir -p "$INSTALL_DIR"
fi
sudo chown -R "$REAL_USER":"$REAL_USER" "$INSTALL_DIR"

# Clone or update repo
if [ ! -d "$INSTALL_DIR/.git" ]; then
    echo "Cloning repository..."
    run_as_user "git clone -b webui --depth 1 https://github.com/CoLorenzo/CRI4.0.git \"$INSTALL_DIR\""
else
    echo "Updating repository..."
    run_as_user "cd \"$INSTALL_DIR\" && git pull"
fi

# Determine valid node bin path for service
# We need the full path to the node executable installed via NVM for the user
NODE_BIN=$(run_as_user ". \"$NVM_DIR/nvm.sh\" && nvm which 25.3.0")
NODE_DIR=$(dirname "$NODE_BIN")

# Install dependencies and build
echo "Building project..."
# We execute these commands as the user inside the directory
run_as_user ". \"$NVM_DIR/nvm.sh\" && cd \"$INSTALL_DIR\" && npm install && npm run build:dll"

# Docker compose build
if [ -d "$INSTALL_DIR/containers" ]; then
    echo "Building containers..."
    cd "$INSTALL_DIR/containers"
    # Sudo is needed for docker if user not in group or group updates not active
    # Using sudo directly here as the script is running as root
    docker compose --profile collector --profile kathara build
else
    echo "Error: $INSTALL_DIR/containers does not exist!"
    exit 1
fi

# Ensure run_webui.sh is executable
if [ -f "$INSTALL_DIR/run_webui.sh" ]; then
    chmod +x "$INSTALL_DIR/run_webui.sh"
else
     echo "Error: $INSTALL_DIR/run_webui.sh does not exist!"
     exit 1
fi

# Create systemd service for ICR
echo "Creating systemd service..."
cat <<EOF | sudo tee /etc/systemd/system/icr.service
[Unit]
Description=ICR
After=network.target

[Service]
User=$REAL_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/run_webui.sh
Environment="PATH=$NODE_DIR:/usr/local/bin:/usr/bin:/bin"
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now icr.service

echo "Setup complete! Please verify the service with: systemctl status icr"