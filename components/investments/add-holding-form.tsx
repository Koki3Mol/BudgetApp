/**
 * components/investments/add-holding-form.tsx
 */

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const Schema = z.object({
  ticker: z.string().optional(),
  name: z.string().min(1, "Asset name is required"),
  assetType: z.enum(["EQUITY", "BOND", "CASH", "CRYPTO", "PROPERTY", "COMMODITY", "OTHER"]),
  currency: z.string().default("ZAR"),
  units: z.coerce.number().positive("Must be positive"),
  avgCost: z.coerce.number().positive("Must be positive"),
  currentPrice: z.coerce.number().optional(),
});

type FormData = z.infer<typeof Schema>;

interface Props {
  onSuccess: () => void;
}

const ASSET_TYPES = ["EQUITY", "BOND", "CASH", "CRYPTO", "PROPERTY", "COMMODITY", "OTHER"] as const;

export function AddHoldingForm({ onSuccess }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema) as never,
    defaultValues: { assetType: "EQUITY", currency: "ZAR" },
  });

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/investments/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "Failed to save."); return; }
      reset();
      onSuccess();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
        {children}
        {error && <p className="text-xs text-negative mt-0.5">{error}</p>}
      </div>
    );
  }

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Asset Name *" error={errors.name?.message}>
          <input {...register("name")} className={inputCls} placeholder="Satrix 40 ETF" />
        </Field>
        <Field label="Ticker (optional)">
          <input {...register("ticker")} className={inputCls} placeholder="STX40" />
        </Field>
        <Field label="Asset Type *">
          <select {...register("assetType")} className={inputCls}>
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Units *" error={errors.units?.message}>
          <input {...register("units")} type="number" step="any" className={inputCls} placeholder="100" />
        </Field>
        <Field label="Avg Cost (per unit) *" error={errors.avgCost?.message}>
          <input {...register("avgCost")} type="number" step="any" className={inputCls} placeholder="85.00" />
        </Field>
        <Field label="Current Price (optional)">
          <input {...register("currentPrice")} type="number" step="any" className={inputCls} placeholder="90.00" />
        </Field>
      </div>
      {error && <p className="text-xs text-negative">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="px-6 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : "Add Holding"}
      </button>
    </form>
  );
}
