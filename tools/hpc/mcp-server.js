#!/usr/bin/env node
// SupercomputerReconnect MCP Server
// Exposes HPC operations as MCP tools for AI agents (Claude Code, etc.)
//
// Install: Add to claude_desktop_config.json or .claude/settings.json:
//   "mcpServers": {
//     "hpc": {
//       "command": "node",
//       "args": ["/path/to/mcp-server.js"]
//     }
//   }

const { execSync, execFileSync, exec } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BIN = process.env.HPC_BIN_DIR || `${process.env.HOME}/.local/bin`;

// ─── Tool Definitions ───────────────────────────────────────

const TOOLS = [
    {
        name: "hpc_status",
        description: "Get full HPC pipeline status: VPN, tunnels, SLURM job, and service health. Returns JSON with vpn, tunnel, job, and services fields. Use this first to understand the current state.",
        inputSchema: {
            type: "object",
            properties: {
                component: {
                    type: "string",
                    enum: ["all", "vpn", "tunnel", "job", "services"],
                    description: "Which component to check. Default: all"
                }
            }
        }
    },
    {
        name: "hpc_reconnect",
        description: "Run the full reconnect pipeline: check/establish VPN, submit SLURM job if needed, wait for node allocation, and establish SSH tunnels. This is the 'morning routine' command. Takes 30-120 seconds depending on job queue.",
        inputSchema: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "hpc_node_switch",
        description: "Switch SSH tunnels to a different HPC compute node. Use 'auto' to auto-detect from SLURM queue.",
        inputSchema: {
            type: "object",
            properties: {
                node: {
                    type: "string",
                    description: "Node hostname (e.g. 'c1100a-s15') or 'auto' to detect from SLURM"
                }
            },
            required: ["node"]
        }
    },
    {
        name: "hpc_tunnel_control",
        description: "Start, stop, or restart the SSH tunnels to the HPC compute node.",
        inputSchema: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["start", "stop", "restart", "status"],
                    description: "Tunnel action"
                }
            },
            required: ["action"]
        }
    },
    {
        name: "hpc_port_add",
        description: "Add a new port forward from HPC to localhost. Requires tunnel restart to take effect.",
        inputSchema: {
            type: "object",
            properties: {
                local_port: { type: "number", description: "Local port on this machine" },
                remote_port: { type: "number", description: "Remote port on the HPC compute node" }
            },
            required: ["local_port", "remote_port"]
        }
    },
    {
        name: "hpc_port_remove",
        description: "Remove a port forward. Requires tunnel restart to take effect.",
        inputSchema: {
            type: "object",
            properties: {
                local_port: { type: "number", description: "Local port to stop forwarding" }
            },
            required: ["local_port"]
        }
    },
    {
        name: "hpc_job_submit",
        description: "Submit a SLURM job from a saved template or the default job script. Returns job ID.",
        inputSchema: {
            type: "object",
            properties: {
                template: {
                    type: "string",
                    description: "Template name from ~/.config/hpc-jobs/ (without .sh). Leave empty for default job script."
                }
            }
        }
    },
    {
        name: "hpc_job_list_templates",
        description: "List available SLURM job templates.",
        inputSchema: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "hpc_ssh_exec",
        description: "Execute a command on the HPC compute node via SSH. Use for checking GPU status, running nvidia-smi, listing files, etc.",
        inputSchema: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "Shell command to run on the HPC node"
                },
                on_jump: {
                    type: "boolean",
                    description: "Run on jump/login node instead of compute node. Default: false (runs on compute node)"
                }
            },
            required: ["command"]
        }
    },
    {
        name: "hpc_connect_workstation",
        description: "Connect to a workstation/gateway to get AI services on localhost. For worker agents.",
        inputSchema: {
            type: "object",
            properties: {
                host: {
                    type: "string",
                    description: "Configured host alias (e.g. 'workstation')"
                },
                action: {
                    type: "string",
                    enum: ["connect", "stop", "status"],
                    description: "Action to perform. Default: connect"
                }
            },
            required: ["host"]
        }
    }
];

// ─── Validation Helpers ────────────────────────────────────

const ALLOWED_STATUS_COMPONENTS = ['vpn', 'tunnel', 'job', 'services', 'all'];
const ALLOWED_TUNNEL_ACTIONS = ['start', 'stop', 'restart', 'status'];

function validatePort(p) {
    const n = parseInt(p, 10);
    if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`Invalid port: ${p}`);
    return n;
}

/**
 * Write a file atomically: write to a temp file in the same directory, then rename.
 * This prevents partial writes from corrupting configuration on crash/power loss.
 */
function atomicWriteFileSync(filePath, content) {
    const dir = path.dirname(filePath);
    const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
    fs.writeFileSync(tmpPath, content, { mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
}

// ─── Tool Handlers ──────────────────────────────────────────

/**
 * Run a command via shell. WARNING: This function uses shell execution.
 * NEVER call this with unsanitized user input. All arguments must be
 * validated/allowlisted before being interpolated into the command string.
 */
function run(cmd, timeout = 30000) {
    try {
        return execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch (e) {
        return e.stdout ? e.stdout.trim() : e.message;
    }
}

function handleTool(name, args) {
    switch (name) {
        case "hpc_status": {
            const comp = args.component || "all";
            if (!ALLOWED_STATUS_COMPONENTS.includes(comp)) throw new Error(`Invalid component: ${comp}`);
            const flag = comp === "all" ? "" : `--${comp}`;
            const out = run(`${BIN}/hpc-status ${flag}`);
            try {
                return { type: "text", text: JSON.stringify(JSON.parse(out), null, 2) };
            } catch {
                return { type: "text", text: out };
            }
        }

        case "hpc_reconnect": {
            const out = run(`${BIN}/hpc-reconnect 2>&1`, 300000);
            return { type: "text", text: out };
        }

        case "hpc_node_switch": {
            if (args.node !== 'auto' && !/^[a-zA-Z0-9_-]+$/.test(args.node)) throw new Error('Invalid node name');
            const flag = args.node === "auto" ? "--auto" : args.node;
            const out = run(`${BIN}/hpc-node ${flag} 2>&1`);
            return { type: "text", text: out };
        }

        case "hpc_tunnel_control": {
            if (!ALLOWED_TUNNEL_ACTIONS.includes(args.action)) throw new Error(`Invalid action: ${args.action}`);
            const out = run(`${BIN}/hpc-node --${args.action} 2>&1`);
            return { type: "text", text: out };
        }

        case "hpc_port_add": {
            const localPort = validatePort(args.local_port);
            const remotePort = validatePort(args.remote_port);
            const conf = `${process.env.HOME}/.config/hpc-tunnel.conf`;
            const content = fs.readFileSync(conf, 'utf-8');
            const match = content.match(/^FORWARD_PORTS=(.*)$/m);
            const current = match ? match[1] : "";
            const newPorts = current ? `${current},${localPort}:${remotePort}` : `${localPort}:${remotePort}`;
            const updated = content.replace(/^FORWARD_PORTS=.*$/m, `FORWARD_PORTS=${newPorts}`);
            atomicWriteFileSync(conf, updated);
            return { type: "text", text: `Added ${localPort}:${remotePort}. Run hpc_tunnel_control restart to apply.` };
        }

        case "hpc_port_remove": {
            const localPort = validatePort(args.local_port);
            const conf = `${process.env.HOME}/.config/hpc-tunnel.conf`;
            const content = fs.readFileSync(conf, 'utf-8');
            const match = content.match(/^FORWARD_PORTS=(.*)$/m);
            if (!match) return { type: "text", text: "No ports configured" };
            const pairs = match[1].split(',').filter(p => !p.startsWith(`${localPort}:`));
            const updated = content.replace(/^FORWARD_PORTS=.*$/m, `FORWARD_PORTS=${pairs.join(',')}`);
            atomicWriteFileSync(conf, updated);
            return { type: "text", text: `Removed port ${localPort}. Run hpc_tunnel_control restart to apply.` };
        }

        case "hpc_job_submit": {
            if (args.template && !/^[a-zA-Z0-9_-]+$/.test(args.template)) throw new Error('Invalid template name');
            const conf = `${process.env.HOME}/.config/hpc-tunnel.conf`;
            const content = fs.readFileSync(conf, 'utf-8');
            const jump = content.match(/^HPC_JUMP=(.*)$/m)?.[1] || "hpg";
            if (!/^[a-zA-Z0-9_.-]+$/.test(jump)) throw new Error('Invalid jump host in config');
            let sbatchTarget;
            if (args.template) {
                sbatchTarget = `${process.env.HOME}/.config/hpc-jobs/${args.template}.sh`;
            } else {
                sbatchTarget = content.match(/^SLURM_JOB_SCRIPT=(.*)$/m)?.[1];
                if (!sbatchTarget) return { type: "text", text: "No default job script configured" };
            }
            let out;
            try {
                out = execFileSync('ssh', ['-o', 'ConnectTimeout=15', '-o', 'BatchMode=yes', jump, `sbatch ${sbatchTarget}`], { encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
            } catch (e) {
                out = e.stdout ? e.stdout.trim() : e.message;
            }
            return { type: "text", text: out };
        }

        case "hpc_job_list_templates": {
            const dir = `${process.env.HOME}/.config/hpc-jobs`;
            try {
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.sh'));
                const templates = files.map(f => {
                    const content = fs.readFileSync(`${dir}/${f}`, 'utf-8');
                    const part = content.match(/#SBATCH.*--partition=(\S+)/)?.[1] || "?";
                    const gpus = content.match(/#SBATCH.*--gpus=(\S+)/)?.[1] || "0";
                    const time = content.match(/#SBATCH.*--time=(\S+)/)?.[1] || "?";
                    const mem = content.match(/#SBATCH.*--mem=(\S+)/)?.[1] || "?";
                    return { name: f.replace('.sh', ''), partition: part, gpus, time, mem };
                });
                return { type: "text", text: JSON.stringify(templates, null, 2) };
            } catch {
                return { type: "text", text: "No templates found" };
            }
        }

        case "hpc_ssh_exec": {
            const conf = `${process.env.HOME}/.config/hpc-tunnel.conf`;
            const content = fs.readFileSync(conf, 'utf-8');
            const target = args.on_jump
                ? (content.match(/^HPC_JUMP=(.*)$/m)?.[1] || "hpg")
                : "hpc";
            if (!/^[a-zA-Z0-9_.-]+$/.test(target)) throw new Error('Invalid SSH target in config');
            // Use execFileSync to avoid shell interpolation — the command string is passed
            // as a single SSH argument, so SSH itself runs it on the remote shell.
            let out;
            try {
                out = execFileSync('ssh', ['-o', 'ConnectTimeout=15', '-o', 'BatchMode=yes', target, args.command], { encoding: 'utf-8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
            } catch (e) {
                out = e.stdout ? e.stdout.trim() : e.message;
            }
            return { type: "text", text: out };
        }

        case "hpc_connect_workstation": {
            const action = args.action || "connect";
            if (!['connect', 'stop', 'status'].includes(action)) throw new Error(`Invalid action: ${action}`);
            if (!/^[a-zA-Z0-9_.-]+$/.test(args.host)) throw new Error('Invalid host name');
            let cmd;
            if (action === "connect") cmd = `${BIN}/hpc-connect ${args.host} 2>&1`;
            else if (action === "stop") cmd = `${BIN}/hpc-connect --stop ${args.host} 2>&1`;
            else cmd = `${BIN}/hpc-connect --status 2>&1`;
            return { type: "text", text: run(cmd) };
        }

        default:
            return { type: "text", text: `Unknown tool: ${name}` };
    }
}

// ─── MCP Protocol (JSON-RPC over stdio) ─────────────────────

const rl = readline.createInterface({ input: process.stdin });
let buffer = '';

function send(msg) {
    const json = JSON.stringify(msg);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
}

function handleMessage(msg) {
    const { id, method, params } = msg;

    switch (method) {
        case "initialize":
            send({
                jsonrpc: "2.0", id,
                result: {
                    protocolVersion: "2024-11-05",
                    capabilities: { tools: {} },
                    serverInfo: {
                        name: "supercomputer-reconnect",
                        version: "1.0.0"
                    }
                }
            });
            break;

        case "notifications/initialized":
            // Client ack — no response needed
            break;

        case "tools/list":
            send({
                jsonrpc: "2.0", id,
                result: { tools: TOOLS }
            });
            break;

        case "tools/call": {
            const { name, arguments: args } = params;
            try {
                const result = handleTool(name, args || {});
                send({
                    jsonrpc: "2.0", id,
                    result: { content: [result] }
                });
            } catch (err) {
                send({
                    jsonrpc: "2.0", id,
                    result: { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true }
                });
            }
            break;
        }

        default:
            if (id) {
                send({
                    jsonrpc: "2.0", id,
                    error: { code: -32601, message: `Method not found: ${method}` }
                });
            }
    }
}

// Parse MCP messages (Content-Length header framing)
process.stdin.on('data', (chunk) => {
    buffer += chunk.toString();

    while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break;

        const header = buffer.substring(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) { buffer = buffer.substring(headerEnd + 4); continue; }

        const len = parseInt(match[1]);
        const bodyStart = headerEnd + 4;
        if (buffer.length < bodyStart + len) break;

        const body = buffer.substring(bodyStart, bodyStart + len);
        buffer = buffer.substring(bodyStart + len);

        try {
            handleMessage(JSON.parse(body));
        } catch (e) {
            process.stderr.write(`Parse error: ${e.message}\n`);
        }
    }
});

process.stderr.write('SupercomputerReconnect MCP server started\n');
