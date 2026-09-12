import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Icon from "../components/Icon";
import {
  api,
  financePaymentMethods,
  financeStatuses,
  financeTransactionTypes,
  getStoredUser,
  scoutUnits as configuredScoutUnits,
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
  return { totalIncome: 0, totalExpenses: 0, balance: 0, debt: 0, thisMonth: 0, pending: 0, transactions: 0 };
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
  const unitLeader = user?.role === "UNIT_LEADER";
  const assignedUnits = unitLeader
    ? user?.assignedUnits?.map((unit) => unit.name) || (user?.unit ? [user.unit] : [])
    : [...configuredScoutUnits];
  const scoutUnits = assignedUnits;
  const unitLocked = unitLeader && assignedUnits.length === 1;
  const auditVisible = user?.role === "ADMIN";
  const defaultUnit = assignedUnits[0] || configuredScoutUnits[0];
  const [filters, setFilters] = useState<FinanceFilters>({});
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary>(emptySummary);
  const [form, setForm] = useState<FinanceTransactionInput>(() => createEmptyTransaction(defaultUnit));
  const [modalOpen, setModalOpen] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const availableCategories = useMemo(() => [...new Set([...categories, ...transactions.map((transaction) => transaction.category)])].sort(), [transactions]);

  const load = async (activeFilters = filters, background = false) => {
    try {
      if (background) setRefreshing(true);
      else {
        setLoading(true);
        setError("");
      }
      const [transactionResult, summaryResult] = await Promise.all([
        api.finance.transactions(activeFilters),
        api.finance.summary(activeFilters),
      ]);
      setTransactions(transactionResult.transactions);
      setSummary(summaryResult.summary);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load finance transactions.");
    } finally {
      if (background) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    const initialTimer = window.setTimeout(() => { void load(filters); }, 180);
    const refreshTimer = window.setInterval(() => { void load(filters, true); }, 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
    // Finance filters and the live refresh both use server-side, scope-safe data.
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

  const balanceLabel = summary.balance < 0 ? "Amount owed" : summary.balance === 0 ? "Balanced" : "Available funds";
  const balanceDescription = summary.balance < 0
    ? `Your permitted scope is in debt by ${formatMoney(summary.debt)}.`
    : summary.balance === 0
      ? "Income and expenses are currently equal."
      : `Your permitted scope has ${formatMoney(summary.balance)} available.`;
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const scopeLabel = hasActiveFilters
    ? "Filtered balance"
    : unitLeader
      ? `Your assigned units balance`
      : user?.role === "ADMIN"
        ? "Whole ScoutOS balance"
        : "Authorized scope balance";

  return (
    <div className="page finance-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Finance & Procurement</span>
          <h1>Financial transactions</h1>
          <p>{unitLeader ? `Your view is secured to ${assignedUnits.join(", ") || "your assigned units"}.` : "Track income, expenses, and the current financial position across your authorized ScoutOS scope."}</p>
        </div>
        <button className="button button-primary" onClick={openCreate} type="button"><Icon name="plus" size={18} />Add transaction</button>
      </header>

      {error && <div className="form-error finance-error">{error}</div>}

      <section className="metrics-grid finance-metrics" aria-label="Financial dashboard">
        <article className={`metric-card finance-balance-card ${summary.balance < 0 ? "is-debt" : summary.balance > 0 ? "is-positive" : "is-even"}`} aria-live="polite"><span className="metric-icon"><Icon name="wallet" size={22} /></span><div><p>{scopeLabel}</p><strong>{formatMoney(Math.abs(summary.balance))}</strong><small>{balanceLabel}</small></div><p className="finance-balance-description">{balanceDescription}</p></article>
        <article className="metric-card"><span className="metric-icon green"><Icon name="wallet" size={22} /></span><div><p>Total income</p><strong>{formatMoney(summary.totalIncome)}</strong><small>Excludes cancelled</small></div></article>
        <article className="metric-card"><span className="metric-icon gold"><Icon name="calendar" size={22} /></span><div><p>Total expenses</p><strong>{formatMoney(summary.totalExpenses)}</strong><small>Excludes cancelled</small></div></article>
        <article className="metric-card"><span className="metric-icon blue"><Icon name="events" size={22} /></span><div><p>Debt</p><strong>{formatMoney(summary.debt)}</strong><small>{summary.debt > 0 ? "Deficit to resolve" : "No debt recorded"}</small></div></article>
        <article className="metric-card"><span className="metric-icon green"><Icon name="folder" size={22} /></span><div><p>Pending</p><strong>{summary.pending}</strong><small>Awaiting completion</small></div></article>
        <article className="metric-card"><span className="metric-icon blue"><Icon name="events" size={22} /></span><div><p>Transactions</p><strong>{summary.transactions}</strong><small>Matching records</small></div></article>
      </section>

      <div className="finance-live-status" aria-live="polite"><span className="status-dot" /> <span>{refreshing ? "Refreshing financial data…" : "Financial data refreshes every 30 seconds."}</span>{lastUpdated && <small>Last synced {formatTimestamp(lastUpdated.toISOString())}</small>}<button className="finance-refresh-button" disabled={refreshing || loading} onClick={() => { void load(filters); }} type="button">Refresh now</button></div>

      <section className="panel table-panel finance-table-panel">
        <div className="finance-filters">
          <label className="search-field"><Icon name="search" size={18} /><input value={filters.search || ""} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search description, vendor, reference..." /></label>
          {!unitLocked && <select aria-label="Filter by unit" value={filters.unit || ""} onChange={(event) => updateFilter("unit", event.target.value as ScoutUnit | "")}><option value="">{unitLeader ? "All my units" : "All units"}</option>{assignedUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>}
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
