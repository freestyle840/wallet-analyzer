import { NextRequest, NextResponse } from "next/server";

const COVALENT_API_KEY = process.env.COVALENT_API_KEY || "";
const DEFAULT_CHAIN_ID = Number(process.env.DEFAULT_CHAIN_ID || 8453); // Base

type TxItem = {
  tx_hash: string; to_address: string | null; from_address: string | null;
  gas_price: string; gas_spent: string; value: string;
  block_signed_at: string; log_events?: any[];
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = (searchParams.get("address") || "").trim();
    const chain = Number(searchParams.get("chain") || DEFAULT_CHAIN_ID);

    if (!/^0x[a-fA-F0-9]{40}$/.test(address))
      return NextResponse.json({ error: "Invalid address (use 0x…)" }, { status: 400 });
    if (!COVALENT_API_KEY)
      return NextResponse.json({ error: "Server missing COVALENT_API_KEY" }, { status: 500 });

    const base = `https://api.covalenthq.com/v1/${chain}`;

    const [balRes, txRes] = await Promise.all([
      fetch(`${base}/address/${address}/balances_v2/`, {
        headers: { Authorization: `Bearer ${COVALENT_API_KEY}` }, cache: "no-store",
      }),
      fetch(`${base}/address/${address}/transactions_v3/?page-size=200`, {
        headers: { Authorization: `Bearer ${COVALENT_API_KEY}` }, cache: "no-store",
      }),
    ]);

    if (!balRes.ok) return NextResponse.json({ error: `Balances error` }, { status: 502 });
    if (!txRes.ok)  return NextResponse.json({ error: `Tx error` }, { status: 502 });

    const balJson = await balRes.json();
    const txJson = await txRes.json();

    const items = balJson?.data?.items ?? [];
    const native = items.find((i: any) => i.native_token || !i.contract_address);
    const nativeDecimals = native?.contract_decimals ?? 18;
    const nativeBal = native ? Number(native.balance) / 10 ** nativeDecimals : 0;

    const tokens = items
      .filter((i: any) => i.type === "cryptocurrency" && !i.native_token)
      .map((i: any) => ({
        symbol: i.contract_ticker_symbol,
        balance: Number(i.balance) / 10 ** (i.contract_decimals ?? 18),
        usd_estimate: i.quote ?? null,
      }))
      .filter((t: any) => t.balance > 0)
      .sort((a: any, b: any) => (b.usd_estimate || 0) - (a.usd_estimate || 0))
      .slice(0, 20);

    const txs: TxItem[] = txJson?.data?.items ?? [];
    const now = Date.now(), d30 = now - 30*86400*1000, d90 = now - 90*86400*1000;
    const toMs = (s: string) => new Date(s).getTime();

    const tx30 = txs.filter((t) => toMs(t.block_signed_at) >= d30);
    const tx90 = txs.filter((t) => toMs(t.block_signed_at) >= d90);

    const gas = (arr: TxItem[]) => arr.reduce((sum, t) =>
      sum + (Number(t.gas_price) * Number(t.gas_spent)) / 1e18, 0);

    const gas30 = gas(tx30), gas90 = gas(tx90);

    const map = new Map<string, number>();
    tx90.forEach((t) => { const to=(t.to_address||"").toLowerCase(); if (to) map.set(to,(map.get(to)||0)+1); });
    const topCounterparties = [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([a])=>a);

    const recent = txs.slice(0,25).map((t) => ({
      hash: t.tx_hash, timestamp: t.block_signed_at, from: t.from_address, to: t.to_address,
      method: t.log_events?.[0]?.decoded?.name ?? (Number(t.value)>0 ? "transfer" : "call"),
      value_native: Number(t.value) / 1e18,
    }));

    const notes: string[] = [];
    if (!tx30.length && nativeBal > 0) notes.push("Dormant last 30d but holds balance.");
    if (gas90 > 0.25) notes.push("High gas usage last 90d.");
    if (tokens.length > 25) notes.push("Many token holdings—possible airdrop hunter.");

    return NextResponse.json({
      chain, address,
      native_balance: Number(nativeBal.toFixed(6)),
      token_holdings: tokens.map((t) => ({ ...t, balance: Number(t.balance.toFixed(6)) })),
      tx_count_30d: tx30.length, tx_count_90d: tx90.length,
      gas_spent_30d: Number(gas30.toFixed(6)), gas_spent_90d: Number(gas90.toFixed(6)),
      top_counterparties: topCounterparties, top_contracts: [],
      recent_txs: recent, notes
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
