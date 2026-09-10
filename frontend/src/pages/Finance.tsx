import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Icon from "../components/Icon";
import {
  api,
  financePaymentMethods,
  financeStatuses,
  financeTransactionTypes,
  getStoredUser,
  scoutUnits,
  type FinanceFilters,
  type FinanceStatus,
  type FinanceSummary,
  type FinanceTransaction,
  type FinanceTransactionInput,
  type FinanceTransactionType,
  type ScoutUnit,
} from "../lib/api";

const categories = ["Activities", "Equipment", "Food", "Training", "Transport", "Uniforms", "Administration", "Fundraising", "Other"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptySummary(): FinanceSummary {
  return { totalExpenses: 0, thisMonth: 0, pending: 0, transactions: 0 };
}

function createEmptyTransaction(unit: ScoutUnit): FinanceTransactionInput {
  return {
    unit,
    transactionType: "EXPENSE",
    category: "Activities",
    description: "",
    vendorPaidTo: "",
    amount: 0,
    paymentMethod: "Cash",
    status: "COMPLETED",
    transactionDate: today(),
    referenceNumber: "",
    notes: "",
  };
}

function inputFromTransaction(transaction: FinanceTransaction): FinanceTransactionInput {
  return {
    unit: transaction.unit,
    transactionType: transaction.transactionType,
    category: transaction.category,
    description: transaction.description,
    vendorPaidTo: transaction.vendorPaidTo,
    amount: transaction.amount,
    paymentMethod: transaction.paymentMethod,
    status: transaction.status,
    transactionDate: transaction.transactionDate,
    referenceNumber: transaction.referenceNumber,
    notes: transaction.notes,
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-JO", { style: "currency", currency: "JOD", minimumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function Finance() {
  const user = getStoredUser();
  const unitLocked = user?.role === "UNIT_LEADER";
  const auditVisible = user?.role === "ADMIN";
  const defaultUnit = unitLocked && user?.unit ? user.unit : scoutUnits[0];
  const [filters, setFilters] = useState<FinanceFilters>({});
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary>(emptySummary);
  const [form, setForm] = useState<FinanceTransactionInput>(() => createEmptyTransaction(defaultUnit));
  const [modalOpen, setModalOpen] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const availableCategories = useMemo(() => [...new Set([...categories, ...transactions.map((transaction) => transaction.category)])].sort(), [transactions]);

  const load = async (activeFilters = filters) => {
    try {
      setLoading(true);
      setError("");
      const [transactionResult, summaryResult] = await Promise.all([
        api.finance.transactions(activeFilters),
        api.finance.summary(activeFilters),
      ]);
      setTransactions(transactionResult.transactions);
      setSummary(summaryResult.summary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load finance transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(filters); }, 180);
    return () => window.clearTimeout(timer);
    // Finance search and filters are server-side so each view remains scope-safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const updateFilter = <K extends keyof FinanceFilters>(key: K, value: FinanceFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setEditing(null);
    setReadOnly(false);
    setForm(createEmptyTransaction(defaultUnit));
    setError("");
    setModalOpen(true);
  };

  const openTransaction = (transaction: FinanceTransaction, viewOnly: boolean) => {
    setEditing(transaction);
    setReadOnly(viewOnly);
    setForm(inputFromTransaction(transaction));
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const saveTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;
    try {
      setSaving(true);
      setError("");
      const result = editing
        ? await api.finance.update(editing.id, form)
        : await api.finance.create(form);
      setTransactions((current) => editing
        ? current.map((transaction) => transaction.id === result.transaction.id ? result.transaction : transaction)
        : [result.transaction, ...current]);
      setModalOpen(false);
      await load(filters);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this transaction.");
    } finally {
      setSaving(false);
    }
  };

  const removeTransaction = async (transaction: FinanceTransaction) => {
    if (!window.confirm(`Delete the ${formatMoney(transaction.amount)} ${titleCase(transaction.transactionType).toLowerCase()} for “${transaction.description}”? This cannot be undone.`)) return;
    try {
      setError("");
      await api.finance.remove(transaction.id);
      setTransactions((current) => current.filter((item) => item.id !== transaction.id));
      await load(filters);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not delete this transaction.");
    }
  };

  return (
    <div className="page finance-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Finance & Procurement</span>
          <h1>Financial transactions</h1>
          <p>{unitLocked && user?.unit ? `Your view is secured to ${user.unit}.` : "Track expenses and income across the ScoutOS scope assigned to your role."}</p>
        </div>
        <button className="button button-primary" onClick={openCreate} type="button"><Icon name="plus" size={18} />Add transaction</button>
      </header>

      {error && <div className="form-error finance-error">{error}</div>}

      <section className="metrics-grid finance-metrics" aria-label="Financial summary">
        <article className="metric-card"><span className="metric-icon green"><Icon name="wallet" size={22} /></span><div><p>Total expenses</p><strong>{formatMoney(summary.totalExpenses)}</strong><small>Excludes cancelled</small></div></article>
        <article className="metric-card"><span className="metric-icon gold"><Icon name="calendar" size={22} /></span><div><p>This month</p><strong>{formatMoney(summary.thisMonth)}</strong><small>Expenses to date</small></div></article>
        <article className="metric-card"><span className="metric-icon blue"><Icon name="events" size={22} /></span><div><p>Pending</p><strong>{summary.pending}</strong><small>Awaiting completion</small></div></article>
        <article className="metric-card"><span className="metric-icon green"><Icon name="folder" size={22} /></span><div><p>Transactions</p><strong>{summary.transactions}</strong><small>Matching records</small></div></article>
      </section>

      <section className="panel table-panel finance-table-panel">
        <div className="finance-filters">
          <label className="search-field"><Icon name="search" size={18} /><input value={filters.search || ""} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search description, vendor, reference..." /></label>
          {!unitLocked && <select aria-label="Filter by unit" value={filters.unit || ""} onChange={(event) => updateFilter("unit", event.target.value as ScoutUnit | "")}><option value="">All units</option>{scoutUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>}
          <select aria-label="Filter by transaction type" value={filters.transactionType || ""} onChange={(event) => updateFilter("transactionType", event.target.value as FinanceTransactionType | "")}><option value="">All types</option>{financeTransactionTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select>
          <select aria-label="Filter by category" value={filters.category || ""} onChange={(event) => updateFilter("category", event.target.value)}><option value="">All categories</option>{availableCategories.map((category) => <option key={category}>{category}</option>)}</select>
          <select aria-label="Filter by status" value={filters.status || ""} onChange={(event) => updateFilter("status", event.target.value as FinanceStatus | "")}><option value="">All statuses</option>{financeStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select>
          <label className="finance-date-filter"><span>From</span><input aria-label="Date from" type="date" value={filters.dateFrom || ""} onChange={(event) => updateFilter("dateFrom", event.target.value)} /></label>
          <label className="finance-date-filter"><span>To</span><input aria-label="Date to" type="date" value={filters.dateTo || ""} onChange={(event) => updateFilter("dateTo", event.target.value)} /></label>
        </div>
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Unit</th><th>Type</th><th>Category</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {transactions.map((transaction) => <tr key={transaction.id}><td>{formatDate(transaction.transactionDate)}</td><td><strong>{transaction.description}</strong><span className="finance-subtle">{transaction.vendorPaidTo || transaction.referenceNumber || "No vendor or reference"}</span></td><td><span className="unit-pill" dir="rtl">{transaction.unit}</span></td><td><span className={`finance-type ${transaction.transactionType.toLowerCase()}`}>{titleCase(transaction.transactionType)}</span></td><td>{transaction.category}</td><td><strong>{formatMoney(transaction.amount)}</strong><span className="finance-subtle">{transaction.paymentMethod}</span></td><td><span className={`finance-status ${transaction.status.toLowerCase()}`}>{titleCase(transaction.status)}</span></td><td><div className="table-actions"><button aria-label={`View ${transaction.description}`} title="View" type="button" onClick={() => openTransaction(transaction, true)}><Icon name="eye" size={16} /></button><button aria-label={`Edit ${transaction.description}`} title="Edit" type="button" onClick={() => openTransaction(transaction, false)}><Icon name="edit" size={16} /></button><button className="danger" aria-label={`Delete ${transaction.description}`} title="Delete" type="button" onClick={() => removeTransaction(transaction)}><Icon name="trash" size={16} /></button></div></td></tr>)}
        </tbody></table></div>
        {loading && <div className="empty-state"><p>Loading financial transactions...</p></div>}
        {!loading && transactions.length === 0 && <div className="empty-state"><span><Icon name="wallet" size={25} /></span><h3>No transactions found</h3><p>Adjust the filters or record the first transaction in your permitted scope.</p><button className="button button-primary empty-state-button" type="button" onClick={openCreate}><Icon name="plus" size={17} />Add transaction</button></div>}
      </section>

      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}><div className="modal finance-modal" role="dialog" aria-modal="true" aria-labelledby="finance-form-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">{readOnly ? "Transaction details" : editing ? "Correct transaction" : "New financial record"}</span><h2 id="finance-form-title">{readOnly ? "View transaction" : editing ? "Edit transaction" : "Add transaction"}</h2></div><button className="round-button" aria-label="Close" disabled={saving} onClick={closeModal} type="button"><Icon name="x" size={18} /></button></div>{error && <div className="form-error">{error}</div>}<form className="scout-form finance-form" onSubmit={saveTransaction}><fieldset disabled={readOnly || saving}><label className="field"><span>Transaction type</span><select value={form.transactionType} onChange={(event) => setForm({ ...form, transactionType: event.target.value as FinanceTransactionType })}>{financeTransactionTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></label><label className="field"><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FinanceStatus })}>{financeStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label><label className="field"><span>Unit</span>{unitLocked ? <input disabled value={user?.unit || ""} /> : <select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value as ScoutUnit })}>{scoutUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>}</label><label className="field"><span>Transaction date</span><input required type="date" value={form.transactionDate} onChange={(event) => setForm({ ...form, transactionDate: event.target.value })} /></label><label className="field"><span>Category</span><input required list="finance-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /><datalist id="finance-categories">{availableCategories.map((category) => <option key={category} value={category} />)}</datalist></label><label className="field"><span>Amount (JOD)</span><input required min="0.01" step="0.01" type="number" value={form.amount || ""} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} /></label><label className="field field-wide"><span>Description</span><input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What was this transaction for?" /></label><label className="field"><span>Vendor / paid to</span><input value={form.vendorPaidTo} onChange={(event) => setForm({ ...form, vendorPaidTo: event.target.value })} placeholder="Supplier or recipient" /></label><label className="field"><span>Payment method</span><select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as FinanceTransactionInput["paymentMethod"] })}>{financePaymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label><label className="field field-wide"><span>Reference number</span><input value={form.referenceNumber} onChange={(event) => setForm({ ...form, referenceNumber: event.target.value })} placeholder="Invoice, receipt, or transfer reference" /></label><label className="field field-wide"><span>Notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional internal notes" /></label></fieldset>{auditVisible && editing && <div className="finance-audit"><div><span>Created by</span><strong>{editing.createdBy?.fullName || "Former ScoutOS user"}</strong><small>{formatTimestamp(editing.createdAt)}</small></div><div><span>Last updated by</span><strong>{editing.updatedBy?.fullName || "Former ScoutOS user"}</strong><small>{formatTimestamp(editing.updatedAt)}</small></div></div>}<div className="form-actions field-wide"><button className="button button-secondary" disabled={saving} type="button" onClick={closeModal}>{readOnly ? "Close" : "Cancel"}</button>{!readOnly && <button className="button button-primary" disabled={saving} type="submit"><Icon name="check" size={18} />{saving ? "Saving..." : editing ? "Save correction" : "Create transaction"}</button>}</div></form></div></div>}
    </div>
  );
}

export default Finance;
