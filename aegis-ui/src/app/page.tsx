"use client";

import { useState } from "react";

type Scenario = {
  name: string;
  sql: string;
  tenant_id: string;
};

const scenarios: Scenario[] = [
  { name: "Cross-tenant leak", sql: "SELECT * FROM INVOICES WHERE tenant_id = 'tenant_beta'", tenant_id: "tenant_alpha" },
  { name: "Destructive SQL", sql: "DROP TABLE CUSTOMERS", tenant_id: "tenant_alpha" },
  { name: "Catalog snooping", sql: "SELECT * FROM EXA_ALL_USERS", tenant_id: "tenant_alpha" },
  { name: "Poisoned row", sql: "SELECT * FROM FEEDBACK", tenant_id: "tenant_alpha" },
  { name: "Safe query", sql: "SELECT * FROM CUSTOMERS WHERE tenant_id = 'tenant_alpha'", tenant_id: "tenant_alpha" },
];

export default function Home() {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(scenarios[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const handleExecute = async () => {
    setLoading(true);
    setResult(null);
    setLatency(null);
    const start = performance.now();
    
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: selectedScenario.sql,
          tenant_id: selectedScenario.tenant_id,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ error: err.message || "Failed to execute query" });
    } finally {
      const end = performance.now();
      setLatency(end - start);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans">
      <header className="flex items-center justify-between border-b border-gray-800 pb-6 mb-8 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            AEGIS-ZERO <span className="text-gray-400 font-normal">— Exasol AI Trust Gateway</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-red-950/50 border border-red-900 rounded-full text-red-500 font-medium text-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          LIVE
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Attack Scenarios</h2>
          <div className="flex flex-wrap gap-3">
            {scenarios.map((scenario) => (
              <button
                key={scenario.name}
                onClick={() => setSelectedScenario(scenario)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedScenario.name === scenario.name
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-gray-900 text-gray-300 hover:bg-gray-800 border border-gray-800"
                }`}
              >
                {scenario.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel */}
          <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
                Unprotected Path
              </h2>
            </div>
            
            <div className="space-y-4 flex-grow">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Tenant ID</label>
                <div className="px-4 py-2 bg-gray-950 rounded border border-gray-800 text-gray-300 font-mono text-sm">
                  {selectedScenario.tenant_id}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Raw SQL Input</label>
                <textarea
                  className="w-full h-32 px-4 py-3 bg-gray-950 rounded border border-gray-800 text-red-400 font-mono text-sm focus:outline-none focus:border-red-500/50 transition-colors resize-none"
                  value={selectedScenario.sql}
                  onChange={(e) => setSelectedScenario({ ...selectedScenario, sql: e.target.value })}
                />
              </div>
            </div>

            <button
              onClick={handleExecute}
              disabled={loading}
              className="mt-6 w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Executing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                  Execute Query
                </>
              )}
            </button>
          </div>

          {/* Right Panel */}
          <div className="bg-gray-900 rounded-xl border border-indigo-900/50 shadow-[0_0_40px_-10px_rgba(79,70,229,0.1)] p-6 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-indigo-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
                Protected Path (Aegis-Zero)
              </h2>
              {latency !== null && (
                <div className="text-xs font-mono text-gray-400 bg-gray-950 px-2 py-1 rounded border border-gray-800">
                  {latency.toFixed(0)}ms
                </div>
              )}
            </div>

            <div className="flex-grow flex flex-col justify-center">
              {!result && !loading && (
                <div className="text-center text-gray-500 flex flex-col items-center py-12">
                  <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                  </svg>
                  <p>Waiting for execution...</p>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center h-full space-y-4 py-12">
                  <div className="w-12 h-12 border-4 border-indigo-900 border-t-indigo-500 rounded-full animate-spin"></div>
                  <p className="text-indigo-400 font-mono text-sm animate-pulse">Analyzing AST...</p>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {result.error ? (
                    <div className="bg-red-950/50 border border-red-900/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-400 mb-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <h3 className="font-semibold">Execution Error</h3>
                      </div>
                      <p className="text-sm text-red-300 font-mono break-all">{result.error}</p>
                    </div>
                  ) : (
                    <>
                      {/* Decision Badge */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-400">Security Decision:</span>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider ${
                          result.decision === 'INVARIANT_VERIFIED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          result.decision === 'BREACH_BLOCKED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-gray-800 text-gray-300'
                        }`}>
                          {result.decision || 'UNKNOWN'}
                        </div>
                      </div>

                      {/* Rewritten SQL */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Rewritten SQL (Safe)</label>
                        <div className="bg-gray-950 rounded p-4 border border-gray-800 font-mono text-sm text-green-400 break-all whitespace-pre-wrap">
                          {result.rewritten_sql || '—'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Sanitized Rows</label>
                          <div className="text-xl font-semibold text-gray-200">
                            {result.row_count !== undefined ? result.row_count : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Cryptographic Receipt */}
                      <div className="bg-gray-950/50 rounded p-4 border border-indigo-900/30">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                          </svg>
                          <h3 className="text-sm font-semibold text-indigo-400">Cryptographic Receipt</h3>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] uppercase text-gray-500 mb-1">Signature</label>
                            <div className="font-mono text-xs text-indigo-200/70 break-all bg-gray-950 p-2 rounded border border-gray-900">
                              {result.receipt?.signature || '—'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-gray-500 mb-1">Public Key</label>
                            <div className="font-mono text-xs text-gray-400 break-all bg-gray-950 p-2 rounded border border-gray-900">
                              {result.receipt?.public_key || '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
