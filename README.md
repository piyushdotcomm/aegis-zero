# Aegis-Zero: Exasol AI Trust Gateway

![Aegis-Zero UI](aegis-ui/public/ui-preview.png)

Aegis-Zero is an enterprise-grade AI security gateway designed to protect databases from malicious Large Language Models (LLMs) and Prompt Injection attacks. It sits as a secure middleware layer (Model Context Protocol) between an AI Agent and your Exasol database, ensuring strict row-level security, blast radius containment, and data exfiltration prevention.

## Features

- **AST Invariant Kernel**: Parses and dynamically rewrites SQL Abstract Syntax Trees to mathematically guarantee tenant isolation (`AND tenant_id = 'X'`). Actively blocks destructive queries (`DROP TABLE`) and catalog snooping.
- **Taint Shield**: Scans database responses in real-time and scrubs known malicious prompt injection payloads before they can reach and hijack the AI Agent.
- **Cryptographic Receipts**: Mints Ed25519 cryptographic signatures for every sanitized payload, allowing the AI agent to guarantee that the data it received was genuinely processed by Aegis-Zero.
- **Model Context Protocol (MCP)**: Wrapped as an official MCP Tool Server (`fastmcp`), allowing zero-configuration integration with any modern AI framework.
- **Dual-Panel Attack Arena UI**: A gorgeous Next.js / Tailwind CSS frontend to visualize hostile payloads being intercepted and sanitized in real time.

## Architecture

1. **Frontend**: Next.js 14 React App
2. **Bridge**: Next.js API Route using `@modelcontextprotocol/sdk` (Stdio transport)
3. **Gateway**: Python `fastmcp` server wrapping the `AegisSecurityPipeline`
4. **Database**: Live Exasol Analytics Database running via Docker

## Quick Start

### 1. Start the Exasol Database
```bash
docker run --name exasoldb -p 8563:8563 --detach --privileged --stop-timeout 120 exasol/docker-db:latest
```

### 2. Seed the Database
Run the setup script to provision the `AEGIS_DEMO` schema and insert the test data (including the malicious prompt injection row).
```bash
python setup_demo_schema.py
```

### 3. Launch the Demo UI
```bash
cd aegis-ui
npm install
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) to view the Attack Arena!

## Attack Scenarios Tested

- ✅ **Safe Query**: Normal tenant data access.
- 🚨 **Cross-tenant Leak**: AI attempts to query another tenant's data (Blocked via AST Rewrite).
- 🚨 **Destructive SQL**: AI attempts to `DROP TABLE` (Blocked by Read-Only Enforcer).
- 🚨 **Catalog Snooping**: AI attempts to query system tables like `EXA_ALL_USERS` (Blocked).
- 🛡️ **Poisoned Row**: AI reads a row containing a prompt injection attack (Sanitized by Taint Shield).

## Built With
- **Python**: `sqlglot`, `cryptography`, `pyexasol`, `fastmcp`
- **TypeScript**: Next.js, Tailwind CSS, `@modelcontextprotocol/sdk`
- **Database**: Exasol (Docker)
