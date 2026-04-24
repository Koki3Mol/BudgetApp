/**
 * app/(app)/settings/page.tsx
 * Account management and app settings.
 */

"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Trash2, X, Check } from "lucide-react";

const AccountSchema = z.object({
  name: z.string().min(1, "Required"),
  institution: z.string().optional(),
  accountNumber: z.string().optional(),
  currency: z.string().min(1).default("ZAR"),
});

type AccountForm = z.infer<typeof AccountSchema>;

interface AccountRecord {
  id: string;
  name: string;
  institution?: string;
  accountNumber?: string;
  currency: string;
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AccountForm>({
    resolver: zodResolver(AccountSchema) as never,
    defaultValues: { currency: "ZAR" },
  });

  const editForm = useForm<AccountForm>({
    resolver: zodResolver(AccountSchema) as never,
  });

  async function fetchAccounts() {
    const res = await fetch("/api/accounts");
    const json = await res.json();
    if (json.success) setAccounts(json.data);
  }

  useEffect(() => { fetchAccounts(); }, []);

  async function onSubmit(data: AccountForm) {
    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess(true);
        reset();
        fetchAccounts();
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(acc: AccountRecord) {
    setEditingId(acc.id);
    setDeleteConfirmId(null);
    editForm.reset({
      name: acc.name,
      institution: acc.institution ?? "",
      accountNumber: "",
      currency: acc.currency,
    });
  }

  async function onEditSubmit(data: AccountForm) {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setEditingId(null);
        fetchAccounts();
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      setDeleteConfirmId(null);
      fetchAccounts();
    }
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-xl">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Bank Accounts</h2>
        <p className="text-sm text-gray-500 mt-0.5">Add your bank accounts to associate imported statements.</p>
      </div>

      {/* Existing accounts */}
      {accounts.length > 0 && (
        <div className="card divide-y divide-gray-50 !p-0">
          {accounts.map((acc) => (
            <div key={acc.id} className="px-4 py-3">
              {editingId === acc.id ? (
                /* ── Inline edit form ── */
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        {...editForm.register("name")}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                      {editForm.formState.errors.name && (
                        <p className="text-xs text-negative mt-0.5">{editForm.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
                      <input
                        {...editForm.register("currency")}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Institution</label>
                    <input
                      {...editForm.register("institution")}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">New Account Number <span className="text-gray-400">(leave blank to keep current)</span></label>
                    <input
                      {...editForm.register("accountNumber")}
                      placeholder="Leave blank to keep masked number"
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              ) : deleteConfirmId === acc.id ? (
                /* ── Delete confirmation ── */
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700">Delete <span className="font-medium">{acc.name}</span>? This cannot be undone.</p>
                  <div className="flex gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => onDelete(acc.id)}
                      className="px-3 py-1.5 rounded-lg bg-negative text-white text-sm font-medium hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Default row ── */
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                    <p className="text-xs text-gray-500">
                      {[acc.institution, acc.accountNumber].filter(Boolean).join(" · ")}
                      {!acc.institution && !acc.accountNumber && <span className="italic">No details</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{acc.currency}</span>
                    <button
                      onClick={() => startEdit(acc)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      title="Edit account"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setDeleteConfirmId(acc.id); setEditingId(null); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-negative hover:bg-red-50 transition-colors"
                      title="Delete account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add account form */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Add Account</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Account Name *</label>
            <input {...register("name")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" placeholder="Cheque Account" />
            {errors.name && <p className="text-xs text-negative mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Institution</label>
            <input {...register("institution")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" placeholder="FNB, Capitec, Nedbank…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Account Number (optional)</label>
            <input {...register("accountNumber")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" placeholder="Will be masked to last 4 digits" />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving…" : "Add Account"}
          </button>
          {success && <p className="text-xs text-positive text-center">Account added successfully.</p>}
        </form>
      </div>
    </div>
  );
}
