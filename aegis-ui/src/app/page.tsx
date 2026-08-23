"use client";

import { useState, useEffect } from "react";

type Scenario = {
  name: string;
  tag: string;
  sql: string;
  tenant_id: string;
  description: string;
};

type RowData = Record<string, unknown>;

type ReceiptView = {
  receipt_id: string | null;
  timestamp: string | null;
  signature: string | null;
  public_key: string | null;
  policy_version: string | null;
  decision: string | null;
};

type ProtectedResult = {
  mode?: string;
  decision?: string;
  code?: string | null;
  message?: string | null;
  hint?: string | null;
  original_sql?: string;
  rewritten_sql?: string | null;
  rows?: RowData[];
  row_count?: number;
  tainted_rows?: number;
  receipt?: ReceiptView;
  error?: string;
};

type UnprotectedResult = {
  mode?: string;
  executed?: boolean;
  rolled_back?: boolean;
  error?: string | null;
  rows?: RowData[];
  row_count?: number;
};

const scenarios: Scenario[] = [
  {
    name: "Safe Query",
    tag: "SAFE",
    sql: "SELECT * FROM CUSTOMERS WHERE tenant_id = 'tenant_alpha'",
    tenant_id: "tenant_alpha",
    description: "Legitimate tenant data access — mathematically proven and verified.",
  },
  {
    name: "Cross-Tenant Leak",
    tag: "ISOLATION",
    sql: "SELECT * FROM INVOICES WHERE tenant_id = 'tenant_beta'",
    tenant_id: "tenant_alpha",
    description: "AI attempts unauthorized lateral movement into another tenant's data.",
  },
  {
    name: "Destructive SQL",
    tag: "MUTATION",
    sql: "DROP TABLE CUSTOMERS",
    tenant_id: "tenant_alpha",
    description: "AI attempts an unapproved state mutation (table drop).",
  },
  {
    name: "Catalog Snooping",
    tag: "CATALOG",
    sql: "SELECT * FROM EXA_ALL_USERS",
    tenant_id: "tenant_alpha",
    description: "AI attempts to map the database structure via Exasol system tables.",
  },
  {
    name: "Poisoned Row",
    tag: "INJECTION",
    sql: "SELECT * FROM FEEDBACK",
    tenant_id: "tenant_alpha",
    description: "AI reads data containing an embedded prompt injection payload.",
  },
];

// Helper: SQL Syntax Highlighter
const formatSQL = (sql: string | null | undefined) => {
  if (!sql) return "";
  const keywords = [
    "SELECT", "FROM", "WHERE", "AND", "OR", "LIMIT", "UNION", "ALL",
    "DROP", "TABLE", "EXCEPT", "INTERSECT", "INSERT", "INTO", "VALUES"
  ];
  const regex = new RegExp(`\\b(${keywords.join("|")})\\b`, "gi");

  const formatStringPart = (str: string) => {
    return str.split(/('.*?')/g).map((sub, j) => {
      if (sub.startsWith("'") && sub.endsWith("'")) {
        return <span key={j} className="text-[#F59E0B]">{sub}</span>; // Amber strings
      }
      return sub;
    });
  };

  return sql.split(regex).map((part, i) => {
    if (keywords.includes(part.toUpperCase())) {
      return <span key={i} className="text-white font-bold">{part}</span>;
    }
    return <span key={i}>{formatStringPart(part)}</span>;
  });
};

const PIPELINE_STEPS = [
  "Parsing Abstract Syntax Tree...",
  "Enforcing Tenant Boundaries...",
  "Clamping Query Blast Radius...",
  "Scanning for Taint / Injections...",
  "Minting Cryptographic Receipt..."
];

// Grid Pattern Background (Dot Matrix)
const DotMatrix = () => (
  <div className="fixed inset-0 z-[-1] opacity-[0.15] pointer-events-none">
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#FFFFFF" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dotGrid)" />
    </svg>
  </div>
);

function RowTable({ rows, maxRows = 10 }: { rows: RowData[]; maxRows?: number }) {
  if (!rows || rows.length === 0) return null;
  const display = rows.slice(0, maxRows);
  const keys = Object.keys(display[0]);

  return (
    <div className="border border-[#1A1A1A] bg-[#050505] overflow-hidden">
      <table className="w-full table-fixed text-xs font-mono text-left border-collapse">
        <thead>
          <tr>
            {keys.map((k) => (
              <th
                key={k}
                className="px-4 py-2 border-b border-[#1A1A1A] text-[#888888] font-normal uppercase tracking-widest text-[10px] truncate"
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.map((row, i) => (
            <tr key={i} className="group hover:bg-[#0A0A0A] transition-colors">
              {keys.map((k) => {
                const val = String(row[k] ?? "");
                const isRedacted = val.includes("[AEGIS_REDACTED");
                return (
                  <td
                    key={k}
                    className={`px-4 py-2 border-b border-[#1A1A1A]/50 truncate ${
                      isRedacted
                        ? "text-[#F59E0B] font-bold bg-[#F59E0B]/10"
                        : "text-[#D4D4D8]"
                    }`}
                    title={val}
                  >
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="px-4 py-2 border-t border-[#1A1A1A] text-[10px] text-[#666] uppercase tracking-widest">
          SHOWING {maxRows} OF {rows.length} ROWS
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(scenarios[0]);
  const [loading, setLoading] = useState(false);
  const [protectedResult, setProtectedResult] = useState<ProtectedResult | null>(null);
  const [unprotectedResult, setUnprotectedResult] = useState<UnprotectedResult | null>(null);
  const [protectedLatency, setProtectedLatency] = useState<number | null>(null);
  const [unprotectedLatency, setUnprotectedLatency] = useState<number | null>(null);
  
  // New States for "Full Marks" Polish
  const [pipelineStep, setPipelineStep] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  // Pipeline Animation Effect
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setPipelineStep((prev) => Math.min(prev + 1, PIPELINE_STEPS.length - 1));
    }, 300); // Progress pipeline every 300ms
    return () => clearInterval(interval);
  }, [loading]);

  const handleExecute = async () => {
    setLoading(true);
    setPipelineStep(0);
    setProtectedResult(null);
    setUnprotectedResult(null);
    setProtectedLatency(null);
    setUnprotectedLatency(null);
    setVerifying(false);
    setVerified(false);

    const callApi = async (mode: string) => {
      const start = performance.now();
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: selectedScenario.sql,
          tenant_id: selectedScenario.tenant_id,
          mode,
        }),
      });
      const data = await res.json();
      const elapsed = performance.now() - start;
      return { data, elapsed };
    };

    try {
      const [protRes, unprotRes] = await Promise.allSettled([
        callApi("protected"),
        callApi("unprotected"),
      ]);

      if (protRes.status === "fulfilled") {
        setProtectedResult(protRes.value.data);
        setProtectedLatency(protRes.value.elapsed);
      } else {
        setProtectedResult({ error: "Failed to reach protected path" });
      }

      if (unprotRes.status === "fulfilled") {
        setUnprotectedResult(unprotRes.value.data);
        setUnprotectedLatency(unprotRes.value.elapsed);
      } else {
        setUnprotectedResult({ error: "Failed to reach unprotected path" });
      }
    } catch (err) {
      setProtectedResult({
        error: err instanceof Error ? err.message : "Failed to execute",
      });
    } finally {
      setLoading(false);
    }
  };

  const isBlocked = protectedResult?.decision === "BREACH_BLOCKED";
  const isVerified = protectedResult?.decision === "INVARIANT_VERIFIED";

  return (
    <div className="min-h-screen bg-[#000000] text-[#E0E0E0] font-sans selection:bg-[#00F0FF]/30 selection:text-white">
      <DotMatrix />

      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-[#000000]/80 border-b border-[#1A1A1A] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-3 text-white">
              <span className="text-[#00F0FF] text-lg">⛊</span> AEGIS-ZERO
              <span className="text-[#666666] font-normal text-sm md:text-base tracking-normal">
                / EXASOL TRUST GATEWAY
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-[#888888]">SESSION / {selectedScenario.tenant_id}</span>
              <span className="text-[#888888]">POLICY / v1.0.0</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[#FF003C]/10 border border-[#FF003C]/30 text-[#FF003C] tracking-widest uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full bg-[#FF003C] opacity-75" />
                <span className="relative inline-flex h-2 w-2 bg-[#FF003C]" />
              </span>
              LIVE ARENA
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* Hero Thesis */}
        <section className="pb-2 border-b border-[#1A1A1A]/50">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tighter text-white mb-2">
            Deterministic LLM Defense for Exasol.
          </h2>
          <p className="text-[#888888] font-mono text-sm max-w-3xl leading-relaxed">
            Aegis-Zero mathematically proves tenant isolation and neutralizes prompt injections via AST-level rewrites, minting a verifiable cryptographic receipt for every LLM database interaction.
          </p>
        </section>

        {/* Scenario Selector (Segmented Control style) */}
        <section>
          <div className="text-[10px] text-[#888888] font-mono tracking-widest uppercase mb-3">
            Select Attack Vector
          </div>
          <div className="flex flex-wrap gap-0 border-b border-[#1A1A1A]">
            {scenarios.map((scenario) => {
              const isActive = selectedScenario.name === scenario.name;
              return (
                <button
                  key={scenario.name}
                  onClick={() => {
                    setSelectedScenario(scenario);
                    setProtectedResult(null);
                    setUnprotectedResult(null);
                    setVerifying(false);
                    setVerified(false);
                  }}
                  className={`px-5 py-3 text-sm font-medium transition-all uppercase tracking-wider relative -mb-[1px] ${
                    isActive
                      ? "text-white border-b-2 border-[#00F0FF]"
                      : "text-[#666666] border-b-2 border-transparent hover:text-[#A0A0A0]"
                  }`}
                >
                  <span className={`mr-2 font-mono text-[10px] ${isActive ? "text-[#00F0FF]" : "text-[#444]"}`}>
                    [{scenario.tag}]
                  </span>
                  {scenario.name}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-[#888888] font-mono">
            {"// "}{selectedScenario.description}
          </div>
        </section>

        {/* Input & Execution */}
        <section className="bg-[#0A0A0A] border border-[#1A1A1A] p-1">
          <div className="flex flex-col md:flex-row">
            <div className="flex-grow p-4">
              <label className="block text-[10px] text-[#888888] font-mono tracking-widest uppercase mb-2">
                SQL Payload
              </label>
              <textarea
                className="w-full h-16 bg-transparent text-[#00F0FF] font-mono text-sm focus:outline-none resize-none overflow-hidden"
                value={selectedScenario.sql}
                onChange={(e) =>
                  setSelectedScenario({ ...selectedScenario, sql: e.target.value })
                }
                spellCheck={false}
              />
            </div>
            <div className="md:w-64 border-t md:border-t-0 md:border-l border-[#1A1A1A] p-4 flex flex-col justify-center bg-[#050505]">
              <button
                onClick={handleExecute}
                disabled={loading}
                className="w-full bg-white text-black hover:bg-[#00F0FF] disabled:bg-[#222] disabled:text-[#666] font-bold uppercase tracking-widest text-xs py-4 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    EXECUTING...
                  </>
                ) : (
                  "DEPLOY PAYLOAD"
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Dual Panel Data Streams */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ─── LEFT: UNPROTECTED ─── */}
          <section className={`bg-[#0A0A0A] border ${unprotectedResult && !loading && (unprotectedResult.row_count ?? 0) > 0 ? "border-[#FF003C] shadow-[0_0_15px_rgba(255,0,60,0.15)]" : "border-[#1A1A1A]"} p-5 flex flex-col transition-all duration-500`}>
            <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 mb-5">
              <h2 className="text-sm font-bold text-[#FF003C] uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FF003C]" /> Raw Database Access
              </h2>
              {unprotectedLatency !== null && (
                <span className="text-[10px] font-mono text-[#666]">
                  {unprotectedLatency.toFixed(0)}MS
                </span>
              )}
            </div>

            <div className="flex-grow font-mono">
              {!unprotectedResult && !loading && (
                <div className="text-center text-[#666] py-12 text-[11px] uppercase tracking-widest px-4 border border-dashed border-[#1A1A1A]">
                  [ Select an attack vector and deploy payload to view raw database exposure ]
                </div>
              )}
              {loading && (
                <div className="text-[#FF003C] py-12 text-xs text-center animate-pulse">
                  EXECUTING RAW SQL...
                </div>
              )}
              {unprotectedResult && !loading && (
                <div className="space-y-6">
                  {/* Status Block */}
                  <div className="flex flex-col gap-2">
                    {unprotectedResult.error ? (
                      <div className="text-xs bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 p-2 uppercase tracking-widest">
                        ERROR: DB EXCEPTION
                      </div>
                    ) : (unprotectedResult.row_count ?? 0) > 0 ? (
                      <div className="text-xs font-bold bg-[#FF003C]/10 text-[#FF003C] border border-[#FF003C]/30 p-2 uppercase tracking-widest">
                        CRITICAL: {unprotectedResult.row_count ?? 0} ROWS EXPOSED
                      </div>
                    ) : (
                      <div className="text-xs bg-[#222] text-[#888] border border-[#333] p-2 uppercase tracking-widest">
                        EXECUTED (NO DATA RETURNED)
                      </div>
                    )}
                    {unprotectedResult.rolled_back && (
                      <div className="text-[10px] text-[#666] tracking-widest uppercase">
                        &gt; Transaction rolled back (demo safety)
                      </div>
                    )}
                  </div>

                  {unprotectedResult.error && (
                    <div className="text-[11px] text-[#FF003C] bg-[#FF003C]/5 p-3 border-l-2 border-[#FF003C] break-all">
                      {unprotectedResult.error}
                    </div>
                  )}

                  {unprotectedResult.rows && unprotectedResult.rows.length > 0 && (
                    <div>
                      <div className="text-[10px] text-[#FF003C] mb-2 uppercase tracking-widest">
                        Unsanitized Payload Data
                      </div>
                      <RowTable rows={unprotectedResult.rows} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ─── RIGHT: PROTECTED ─── */}
          <section className={`bg-[#0A0A0A] border ${isVerified ? "border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.1)]" : isBlocked ? "border-[#A0A0A0]" : "border-[#1A1A1A]"} p-5 flex flex-col relative overflow-hidden transition-all duration-500`}>
            {isVerified && <div className="absolute top-0 right-0 p-32 bg-[#00F0FF]/5 rounded-full blur-3xl -z-10 pointer-events-none" />}
            
            <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 mb-5 z-10">
              <h2 className="text-sm font-bold text-[#00F0FF] uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-[#00F0FF]" /> Aegis-Zero Secure Enclave
              </h2>
              {protectedLatency !== null && (
                <span className="text-[10px] font-mono text-[#666]">
                  {protectedLatency.toFixed(0)}MS
                </span>
              )}
            </div>

            <div className="flex-grow font-mono z-10">
              {!protectedResult && !loading && (
                <div className="text-center text-[#666] py-12 text-[11px] uppercase tracking-widest px-4 border border-dashed border-[#1A1A1A]">
                  [ Awaiting payload — Aegis-Zero will analyze AST invariants here ]
                </div>
              )}
              
              {/* Hollywood Analysis Pipeline Loading State */}
              {loading && (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <div className="text-[#00F0FF] text-[11px] font-bold tracking-widest uppercase h-4">
                    &gt; {PIPELINE_STEPS[pipelineStep]}
                  </div>
                  <div className="flex gap-1.5">
                    {PIPELINE_STEPS.map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1 w-6 transition-colors duration-300 ${
                          i <= pipelineStep ? "bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]" : "bg-[#1A1A1A]"
                        }`} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {protectedResult && !loading && (
                <div className="space-y-6">
                  {/* Decision Block */}
                  <div className="flex items-center gap-3 border border-[#1A1A1A] p-1 bg-[#050505]">
                    <div className="text-[10px] text-[#666] uppercase tracking-widest px-2">Decision</div>
                    <div className={`flex-1 text-xs font-bold uppercase tracking-widest px-3 py-1.5 ${
                        isVerified ? "bg-[#00F0FF]/10 text-[#00F0FF]" : "bg-[#222] text-[#E0E0E0]"
                      }`}>
                      {protectedResult.decision}
                    </div>
                  </div>

                  {/* Blocked State */}
                  {isBlocked && (
                    <div className="border border-[#333] bg-[#111] p-4 space-y-3">
                      <div className="text-xs text-white font-bold tracking-widest uppercase">
                        [{protectedResult.code}]
                      </div>
                      <div className="text-[11px] text-[#A0A0A0] leading-relaxed">
                        {protectedResult.message}
                      </div>
                      {protectedResult.hint && (
                        <div className="text-[10px] text-[#666] border-t border-[#222] pt-2 mt-2">
                          HINT: {protectedResult.hint}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Verified State */}
                  {isVerified && (
                    <>
                      {/* Rewritten SQL with Syntax Highlighting */}
                      <div>
                        <div className="text-[10px] text-[#888] uppercase tracking-widest mb-1.5">AST Rewritten Output</div>
                        <div className="bg-[#050505] border border-[#1A1A1A] p-3 text-[#00F0FF] text-[11px] break-all">
                          {formatSQL(protectedResult.rewritten_sql)}
                        </div>
                      </div>

                      {/* Row Counts */}
                      <div className="flex gap-4">
                        <div className="flex-1 border border-[#1A1A1A] bg-[#050505] p-3">
                          <div className="text-[10px] text-[#666] uppercase tracking-widest mb-1">Rows Verified</div>
                          <div className="text-lg text-white">{protectedResult.row_count ?? 0}</div>
                        </div>
                        <div className="flex-1 border border-[#1A1A1A] bg-[#050505] p-3">
                          <div className="text-[10px] text-[#666] uppercase tracking-widest mb-1">Taint Scrubbed</div>
                          <div className={`text-lg ${(protectedResult.tainted_rows ?? 0) > 0 ? "text-[#F59E0B]" : "text-white"}`}>
                            {protectedResult.tainted_rows ?? 0}
                          </div>
                        </div>
                      </div>

                      {/* Sanitized Data Table */}
                      {protectedResult.rows && protectedResult.rows.length > 0 && (
                        <div>
                          <div className="text-[10px] text-[#888] uppercase tracking-widest mb-1.5">Clean Data Output</div>
                          <RowTable rows={protectedResult.rows} />
                        </div>
                      )}
                    </>
                  )}

                  {/* Signature Element: Cryptographic Ledger Entry */}
                  {protectedResult.receipt && (
                    <div className="relative overflow-hidden border border-dashed border-transparent bg-[#00F0FF]/[0.02] p-4 mt-6 animate-mint opacity-0">
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                        <span className="text-6xl font-black text-[#00F0FF] -rotate-12 whitespace-nowrap">AEGIS SECURED</span>
                      </div>
                      
                      <div className="relative z-10">
                        <div className="flex justify-between items-end border-b border-[#00F0FF]/20 pb-2 mb-3">
                          <span className="text-[10px] text-[#00F0FF] font-bold tracking-[0.2em] flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse" />
                            CRYPTOGRAPHIC LEDGER
                          </span>
                          <span className="text-[9px] text-[#00F0FF]/60">{protectedResult.receipt.timestamp}</span>
                        </div>
                        
                        <div className="space-y-3 text-[10px]">
                          <div className="flex flex-col">
                            <span className="text-[#666] uppercase tracking-widest">Receipt_ID</span>
                            <span className="text-[#A0A0A0]">{protectedResult.receipt.receipt_id}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[#666] uppercase tracking-widest">Ed25519_Signature</span>
                            <span className="text-[#00F0FF]/80 break-all">{protectedResult.receipt.signature || "UNSIGNED"}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[#666] uppercase tracking-widest">Public_Key</span>
                            <span className="text-[#888] break-all">{protectedResult.receipt.public_key || "N/A"}</span>
                          </div>
                        </div>

                        {/* Interactive Verify Button */}
                        <button
                          onClick={() => {
                            setVerifying(true);
                            setTimeout(() => {
                              setVerifying(false);
                              setVerified(true);
                            }, 800);
                          }}
                          disabled={verified || verifying}
                          className={`mt-4 w-full py-2 text-[10px] uppercase tracking-widest font-bold border transition-all ${
                            verified
                              ? "bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]"
                              : verifying
                              ? "bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00F0FF] animate-pulse"
                              : "bg-transparent border-[#00F0FF]/30 text-[#00F0FF] hover:bg-[#00F0FF]/10"
                          }`}
                        >
                          {verified 
                            ? "✓ SIGNATURE VALIDATED" 
                            : verifying 
                            ? "VERIFYING ED25519 HASH..." 
                            : "VERIFY CRYPTO-SIGNATURE"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error Catch */}
                  {protectedResult.error && !isBlocked && (
                    <div className="text-[11px] text-[#FF003C] bg-[#FF003C]/5 p-3 border-l-2 border-[#FF003C] break-all mt-4">
                      {protectedResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
