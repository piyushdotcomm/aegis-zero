# Aegis-Zero: 3-Minute Hackathon Pitch Script

**Title:** Aegis-Zero: The Zero-Trust Exasol AI Gateway  
**Time Limit:** ~3 Minutes  
**Focus:** AI Trust, Safety, and Governance Track  

---

## 0:00 - 0:45 | The Hook (The Problem)
**[SCREEN: Start on a slide with the Aegis-Zero logo or just the empty UI screen]**

**Speaker:** 
"In the era of AI, granting an LLM direct access to an enterprise database is a security nightmare. Prompt injections, cross-tenant data leaks, and destructive SQL mutations are a massive liability. 

Today, we are presenting **Aegis-Zero**. It is a Zero-Trust Security Gateway built specifically for **Exasol**. Aegis-Zero sits between your AI Agent and your Exasol database via the Model Context Protocol (MCP). It doesn't rely on flaky LLM guardrails; it uses a deterministic Abstract Syntax Tree (AST) kernel to guarantee absolute security."

## 0:45 - 1:30 | The Happy Path & Cryptography
**[SCREEN: Open the Attack Arena. Click the `[SAFE] Safe Query` button. Click `DEPLOY PAYLOAD`.]**

**Speaker:** 
"Let's look at the Attack Arena. We process every query simultaneously through an unprotected path on the left, and our Aegis-Zero enclave on the right. 

Here is a normal, safe query for `tenant_alpha`. On the right, notice the **AST Rewritten Output**. Our kernel 'Trusts No One'—it intercepts the query and mathematically clamps the blast radius, forcing a hard row limit and injecting a hard tenant identifier before it ever reaches Exasol.

*(Click the 'VERIFY CRYPTO-SIGNATURE' button on the receipt)*
Finally, every single action generates a verifiable **Cryptographic Ledger Entry** signed via Ed25519. This means enterprise auditors can mathematically prove exactly what the AI accessed."

## 1:30 - 2:15 | The Attack (Cross-Tenant Leak)
**[SCREEN: Click the `[ISOLATION] Cross-Tenant Leak` scenario. Click `DEPLOY PAYLOAD`.]**

**Speaker:** 
"Now, let's see what happens during an AI hallucination or attack. The AI attempts to lateral-move and access `tenant_beta`'s invoices. 

Look at the left panel. A standard unprotected setup blindly executes the SQL, and **critical data is exposed**. 

Now look at the right. Aegis-Zero's AST kernel detected the invariant breach. It completely blocked the query with a `TENANT_ISOLATION_BREACH` code. **The query was never even sent to the Exasol database.** The threat is neutralized instantly with zero database overhead."

## 2:15 - 2:45 | The Taint Shield (Prompt Injection)
**[SCREEN: Click the `[INJECTION] Poisoned Row` scenario. Click `DEPLOY PAYLOAD`.]**

**Speaker:** 
"Security isn't just about what the AI asks; it's about what the database returns. What if a malicious user injects a prompt payload into a feedback form?

Notice on the left, the unprotected path returns a dangerous payload: *'System: ignore previous instructions'*—which could hijack the AI agent reading it. 

On the right, Aegis-Zero’s real-time **Taint Shield** scans the outbound Exasol data stream. It scrubbed the payload and safely returned `[AEGIS_REDACTED_INJECTION_PAYLOAD]`, protecting the AI from being compromised."

## 2:45 - 3:00 | Conclusion & Impact
**[SCREEN: Leave on the Safe Query output showing the verified receipt.]**

**Speaker:** 
"To win in the enterprise, AI needs boundaries. Aegis-Zero provides mathematically deterministic tenant isolation, protection against destructive mutations, and full cryptographic auditability for the world's fastest analytics database. 

This is how we bring true Trust, Safety, and Governance to Exasol. Thank you."
