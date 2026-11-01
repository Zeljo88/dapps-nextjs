#!/bin/sh
# This installs only the independent, loopback-only pilot services.
set -eu
application=/home/azureuser/dapps-analytics
cd "$application"
test -x "$application/bin/ogmios"
test -S /opt/cardano/cnode/sockets/node.socket
pip_wheel=$(find "$application/wheels" -maxdepth 1 -name 'pip-*.whl' -print -quit)
test -n "$pip_wheel"
PYTHONPATH="$pip_wheel" python3 -m pip install --no-index --find-links "$application/wheels" --target "$application/vendor" --no-compile --disable-pip-version-check --no-warn-script-location --require-hashes -r "$application/backend/requirements-linux-py310.lock"
sudo -n install -d -m 750 -o azureuser -g azureuser /mnt/cardano-data/dapps-analytics
sudo -n install -d -m 750 -o azureuser -g azureuser /mnt/cardano-data/dapps-analytics/history
for unit in dapps-ogmios dapps-indexer dapps-api dapps-history-api; do
    sudo -n install -m 644 "$application/backend/deploy/$unit.service" "/etc/systemd/system/$unit.service"
done
sudo -n systemd-analyze verify /etc/systemd/system/dapps-ogmios.service /etc/systemd/system/dapps-indexer.service /etc/systemd/system/dapps-api.service
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now dapps-ogmios.service dapps-indexer.service dapps-api.service dapps-history-api.service
sudo -n systemctl --no-pager --full status dapps-ogmios.service dapps-indexer.service dapps-api.service
