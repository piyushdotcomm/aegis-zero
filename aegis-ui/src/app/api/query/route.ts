import { NextResponse } from 'next/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

export async function POST(req: Request) {
  let transport: StdioClientTransport | null = null;
  try {
    const body = await req.json();
    const { sql, tenant_id } = body;

    if (!sql || !tenant_id) {
      return NextResponse.json({ error: 'Missing sql or tenant_id' }, { status: 400 });
    }

    const pythonPath = path.join(process.cwd(), '..', 'venv', 'Scripts', 'python.exe');
    const serverPath = path.join(process.cwd(), '..', 'server.py');

    transport = new StdioClientTransport({
      command: pythonPath,
      args: [serverPath]
    });

    const client = new Client(
      { name: 'aegis-ui', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);

    const result = await client.callTool({
      name: 'execute_exasol_query',
      arguments: {
        sql,
        tenant_id
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error executing MCP tool:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  } finally {
    if (transport) {
      try {
        await transport.close();
      } catch (err) {
        console.error('Error closing transport:', err);
      }
    }
  }
}
