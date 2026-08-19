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
        sql_query: sql,
        tenant_id
      }
    });

    let payload: any = {};
    if (result.content && result.content.length > 0) {
      const text = (result.content[0] as any).text;
      try {
        payload = JSON.parse(text);
      } catch (e) {
        payload = { raw: text };
      }
    }

    if (result.isError) {
       return NextResponse.json({ 
         decision: "BREACH_BLOCKED", 
         error: (result.content[0] as any).text || "Tool execution failed" 
       });
    }

    // Map Python dict to Next.js expected format
    const responseData = {
      decision: "INVARIANT_VERIFIED",
      rewritten_sql: payload.payload?.query || payload.query || sql,
      row_count: payload.payload?.results?.length || payload.results?.length || 0,
      tainted_rows: payload.payload?.tainted_rows || payload.tainted_rows || 0,
      receipt: {
        signature: payload.signature_ed25519 || payload.signature || "No signature",
        public_key: "ed25519_pub_aegis_zero_node1"
      }
    };

    return NextResponse.json(responseData);
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
