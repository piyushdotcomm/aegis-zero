# Aegis-Zero UI Implementation Plan (Next.js)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Phase 3 of Aegis-Zero (The Demo UI) using a beautiful Next.js + Tailwind CSS application.

**Architecture:** Next.js (React) Frontend → Next.js API Route (Node.js) → `@modelcontextprotocol/sdk` (stdio) → Aegis-Zero Python MCP Server → Exasol DB.

**Tech Stack:** Next.js, React, Tailwind CSS, TypeScript, `@modelcontextprotocol/sdk`.

---

### Task 13: Initialize Next.js Application

**Files:**
- Create: `aegis-ui/` (Next.js project root)

**Interfaces:**
- Produces: A scaffolded Next.js app with Tailwind CSS.

- [ ] **Step 1: Create Next.js App**
Run `npx create-next-app@latest aegis-ui --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`
- [ ] **Step 2: Install MCP Client SDK**
Run `cd aegis-ui && npm install @modelcontextprotocol/sdk`
- [ ] **Step 3: Commit**
Commit the initialized Next.js project.

### Task 14: Build the MCP Bridge API

**Files:**
- Create: `aegis-ui/src/app/api/query/route.ts`

**Interfaces:**
- Produces: A Next.js API route that accepts SQL queries, connects to the Python MCP server via stdio, and returns the result.

- [ ] **Step 1: Implement API Route**
Write the POST handler that uses `Client` and `StdioClientTransport` from `@modelcontextprotocol/sdk` to execute `python server.py`, call the `execute_exasol_query` tool, and return the payload.

### Task 15: Build the Dual-Panel Attack Arena

**Files:**
- Modify: `aegis-ui/src/app/page.tsx`

**Interfaces:**
- Produces: The main UI layout required by the spec (Header, Left Panel Unprotected, Right Panel Protected).

- [ ] **Step 1: Implement UI Layout**
Build the sleek dark-mode dual-panel layout using Tailwind CSS. Include buttons for the 5 required attack scenarios (Cross-tenant leak, Destructive SQL, Catalog snooping, Poisoned row, Safe query).
- [ ] **Step 2: Wire up state and API calls**
Connect the UI buttons to the API route to fetch and display the AST decisions, latency, sanitized rows, and cryptographic receipts.
