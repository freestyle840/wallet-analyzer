"use client";
import { useState } from "react";
import "./globals.css";

export default function Page() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("8453"); // Base
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setLoading(true); setError(null); setData(null);
    const qs = new URLSearchParams({ address, chain });
    const res = await fetch(`/api/analyze?${qs.toString()}`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) { setError(j.error || "Request failed"); setLoading(false); return; }
    setData(j); setLoading(false);
  }

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Wallet Analyzer</h1>
        <p className="small" style={{ marginTop: 6 }}>Paste any EVM address. Default chain: <b>Base</b>.</p>

        <div className="row" style={{ marginTop: 12 }}>
          <input className="input" placeholder="0x… wallet address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <select className="input" style={{ width: 140 }} value={chain} onChange={(e)=>setChain(e.target.value)}>
            <option value="8453">Base</option>
            <option value="43114">Avalanche C-Chain</option>
            <option value="1">Ethereum</option>
            <option value="137">Polygon</option>
            <option value="56">BSC</option>
          </select>
          <button className="btn" disabled={!address || loading} onClick={analyze}>{loading ? "Analyzing…" : "Analyze"}</button>
        </div>

        {error && <p style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p>}
      </div>

      {data && (
        <>
          <div className="grid">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Overview</h3>
              <ul className="small" style={{ lineHeight: 1.8 }}>
                <li><b>Address:</b> {data.address}</li>
                <li><b>Chain ID:</b> {data.chain}</li>
                <li><b>Native balance:</b> {data.native_balance}</li>
                <li><b>Tx (30d / 90d):</b> {data.tx_count_30d} / {data.tx_count_90d}</li>
                <li><b>Gas (30d / 90d):</b> {data.gas_spent_30d} / {data.gas_spent_90d} ETH</li>
                {data.notes?.length ? <li><b>Notes:</b> {data.notes.join(" · ")}</li> : null}
              </ul>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0 }}>Top counterparties (90d)</h3>
              {data.top_counterparties.length === 0 ? <p className="small">None</p> : (
                <ol className="small" style={{ marginTop: 4 }}>
                  {data.top_counterparties.map((a: string) => (<li key={a}>{a}</li>))}
                </ol>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Top tokens</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead><tr><th>Symbol</th><th>Balance</th><th>USD est.</th></tr></thead>
                <tbody>
                  {data.token_holdings.map((t: any, i: number) => (
                    <tr key={i}><td>{t.symbol}</td><td>{t.balance}</td><td>{t.usd_estimate ?? "-"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Recent transactions</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr><th>Time</th><th>From</th><th>To</th><th>Method</th><th>Value (ETH)</th><th>Hash</th></tr>
                </thead>
                <tbody>
                  {data.recent_txs.map((t: any) => (
                    <tr key={t.hash}>
                      <td>{new Date(t.timestamp).toLocaleString()}</td>
                      <td>{t.from ?? "-"}</td>
                      <td>{t.to ?? "-"}</td>
                      <td>{t.method}</td>
                      <td>{t.value_native}</td>
                      <td>{t.hash.slice(0,10)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
