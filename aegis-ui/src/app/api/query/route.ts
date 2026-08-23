import { NextResponse } from 'next/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

type ToolContent = { type: string; text?: string };
type ToolResult = { content?: ToolContent[]; isError?: boolean };

interface ToolPayload {
  decision?: string;
  code?: string | null;
  message?: string | null;
  hint?: string | null;
  original_sql?: string;
  rewritten_sql?: string | null;
  results?: Record<string, unknown>[];
  row_count?: number;
  tainted_rows?: number;
  receipt?: Record<string, string | null>;
  executed?: boolean;
  rolled_back?: boolean;
  error?: string | null;
  rows?: Record<string, unknown>[];
  sql?: string;
  raw?: string;
}

async function callMcpTool(toolName: string, args: Record<string, unknown>) {
  const isWindows = process.platform === 'win32';
  const pythonBin = isWindows ? 'python.exe' : 'python';
  const pythonPath = path.join(process.cwd(), '..', 'venv', isWindows ? 'Scripts' : 'bin', pythonBin);
  const serverPath = path.join(process.cwd(), '..', 'server.py');

  const transport = new StdioClientTransport({
    command: pythonPath,
    args: [serverPath],
  });

  try {
    const client = new Client(
      { name: 'aegis-ui', version: '1.0.0' },
      { capabilities: {} },
    );
    await client.connect(transport);
    const result = (await client.callTool({ name: toolName, arguments: args })) as ToolResult;

    let payload: ToolPayload = {};
    if (result.content && result.content.length > 0) {
      const text = result.content[0]?.text ?? '';
      try {
        payload = JSON.parse(text) as ToolPayload;
      } catch {
        payload = { raw: text };
      }
    }

    if (result.isError) {
      return {
        decision: 'BREACH_BLOCKED',
        error: result.content?.[0]?.text || 'Tool execution failed',
      };
    }

    return payload;
  } finally {
    try {
      await transport.close();
    } catch {
      // transport may already be closed
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sql, tenant_id, mode } = body;

    if (!sql) {
      return NextResponse.json({ error: 'Missing sql' }, { status: 400 });
    }

    if (mode === 'unprotected') {
      const payload = await callMcpTool('execute_unprotected_query', { sql_query: sql });
      return NextResponse.json({
        mode: 'unprotected',
        executed: payload.executed ?? false,
        rolled_back: payload.rolled_back ?? true,
        error: payload.error || null,
        rows: payload.rows || [],
        row_count: payload.row_count ?? payload.rows?.length ?? 0,
      });
    }

    // Protected path (default)
    if (!tenant_id) {
      return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 });
    }

    const payload = await callMcpTool('execute_exasol_query', { sql_query: sql, tenant_id });

    const receipt = payload.receipt || {};

    return NextResponse.json({
      mode: 'protected',
      decision: payload.decision || 'UNKNOWN',
      code: payload.code || null,
      message: payload.message || null,
      hint: payload.hint || null,
      original_sql: payload.original_sql || sql,
      rewritten_sql: payload.rewritten_sql || null,
      rows: payload.results || [],
      row_count: payload.row_count ?? 0,
      tainted_rows: payload.tainted_rows ?? 0,
      receipt: {
        receipt_id: receipt.receipt_id || null,
        timestamp: receipt.timestamp_utc || null,
        signature: receipt.signature_ed25519 || null,
        public_key: receipt.public_key_ed25519 || null,
        policy_version: receipt.policy_version || null,
        decision: receipt.decision || null,
      },
    });
  } catch (error) {
    console.error('Error executing MCP tool:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}
