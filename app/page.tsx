"use client";

import { useState } from "react";
import { ItemComparison } from "@/components/ItemComparison";
import { BasketSummary } from "@/components/BasketSummary";
import { PLATFORM_META } from "@/components/platformMeta";
import type { SearchApiResponse } from "@/types";

const EXAMPLES = ["Amul Taaza 1L", "Milk, bread, eggs and Maggi", "2 packets Maggi and coke zero"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [pincode, setPincode] = useState(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("khoj:pincode") ?? "" : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchApiResponse | null>(null);

  async function runSearch(q: string, pc: string) {
    if (!q.trim()) {
      setError("Enter something to search for.");
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(pc.trim())) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    window.localStorage.setItem("khoj:pincode", pc.trim());

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&pincode=${encodeURIComponent(pc)}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Something went wrong.");
        return;
      }
      setData(body);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="border-b border-zinc-100">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <span className="text-xl font-extrabold tracking-tight text-zinc-900">khoj</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
            One search. Every quick-commerce app.
          </h1>
          <p className="max-w-xl text-lg text-zinc-500">
            Compare prices, availability and delivery times across{" "}
            <span className="font-semibold text-yellow-600">Blinkit</span>,{" "}
            <span className="font-semibold text-fuchsia-600">Zepto</span> and{" "}
            <span className="font-semibold text-orange-600">Instamart</span>.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query, pincode);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search e.g. Amul Taaza 1L, or milk, bread, eggs and Maggi"
            className="flex-1 rounded-2xl border border-zinc-200 px-5 py-4 text-base shadow-sm outline-none focus:border-zinc-900"
          />
          <input
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Pincode"
            inputMode="numeric"
            className="w-full rounded-2xl border border-zinc-200 px-5 py-4 text-base shadow-sm outline-none focus:border-zinc-900 sm:w-32"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-zinc-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {!data && !loading && (
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setQuery(ex);
                  if (pincode) runSearch(ex, pincode);
                }}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-800"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>
        )}

        {loading && (
          <div className="flex flex-col gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-zinc-100" />
            ))}
          </div>
        )}

        {data && !loading && (
          <div className="flex flex-col gap-10">
            {data.providerWarnings.length > 0 && (
              <div className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-700">
                {data.providerWarnings.map((w) => (
                  <div key={w.platform}>
                    {PLATFORM_META[w.platform as keyof typeof PLATFORM_META]?.label ?? w.platform}:{" "}
                    {w.errorMessage || "temporarily unavailable"}
                  </div>
                ))}
              </div>
            )}

            {data.basket && <BasketSummary items={data.items} basket={data.basket} />}

            <div className="flex flex-col gap-8">
              {data.items.map((item) => (
                <ItemComparison key={item.query} item={item} />
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-400">
        Prices and availability shown are point-in-time and may change before checkout.
      </footer>
    </div>
  );
}
