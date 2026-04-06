#!/bin/bash
# SSH tunnel to HPC Qwen3-Omni instances (4x B200)
# Requires eduVPN to be connected

while true; do
    echo "[$(date)] Starting HPC tunnel..."
    ssh -o StrictHostKeyChecking=no \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -o ExitOnForwardFailure=yes \
        -N \
        -L 18080:0.0.0.0:8080 \
        -L 18081:0.0.0.0:8081 \
        -L 18082:0.0.0.0:8082 \
        -L 18083:0.0.0.0:8083 \
        hpc
    echo "[$(date)] Tunnel died, restarting in 5s..."
    sleep 5
done
