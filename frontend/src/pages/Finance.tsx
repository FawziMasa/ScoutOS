import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Icon from "../components/Icon";
import {
  api,
  financePaymentMethods,
  financeStatuses,
  financeTransactionTypes,
  getStoredUser,
  scoutUnits as configuredScoutUnits,
  type FinanceFilters,
  type FinanceAttachment,
  type FinanceStatus,
  type FinanceStatusHistory,
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

function formatFileSize(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
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
  const canApprove = user?.role === "ADMIN";
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
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [history, setHistory] = useState<FinanceStatusHistory[]>([]);
  const [attachments, setAttachments] = useState<FinanceAttachment[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
    setHistory([]);
    setAttachments([]);
    setError("");
    setNotice("");
    setModalOpen(true);
  };

  const openTransaction = (transaction: FinanceTransaction, viewOnly: boolean) => {
    setEditing(transaction);
    setReadOnly(viewOnly);
    setForm(inputFromTransaction(transaction));
    setHistory([]);
    setAttachments([]);
    setError("");
    setModalOpen(true);
    void api.finance.history(transaction.id)
      .then((result) => setHistory(result.history))
      .catch((detailsError) => setError(detailsError instanceof Error ? detailsError.message : "Could not load transaction history."));
    void api.finance.attachments(transaction.id)
      .then((result) => setAttachments(result.attachments))
      .catch((detailsError) => setError(detailsError instanceof Error ? detailsError.message : "Could not load receipt files."));
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
      setNotice("");
      const result = editing
        ? await api.finance.update(editing.id, form)
        : await api.finance.create(form);
      setTransactions((current) => editing
        ? current.map((transaction) => transaction.id === result.transaction.id ? result.transaction : transaction)
        : [result.transaction, ...current]);
      setModalOpen(false);
      await load(filters);
      setNotice(editing ? "Draft transaction updated." : "Draft transaction created. Submit it when it is ready for approval.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this transaction.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    transaction: FinanceTransaction,
    action: () => Promise<{ transaction: FinanceTransaction }>,
    message: string,
  ) => {
    try {
      setActionBusyId(transaction.id);
      setError("");
      setNotice("");
      await action();
      await load(filters);
      setNotice(message);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update this transaction.");
    } finally {
      setActionBusyId(null);
    }
  };

  const submitForApproval = (transaction: FinanceTransaction) => runAction(
    transaction,
    () => api.finance.submit(transaction.id),
    "Transaction submitted for Admin approval.",
  );

  const approve = (transaction: FinanceTransaction) => {
    if (!window.confirm(`Approve ${formatMoney(transaction.amount)} for “${transaction.description}”?`)) return;
    void runAction(transaction, () => api.finance.approve(transaction.id), "Transaction approved and included in the balance.");
  };

  const reject = (transaction: FinanceTransaction) => {
    const reason = window.prompt("Why is this transaction being rejected?");
    if (reason === null) return;
    void runAction(transaction, () => api.finance.reject(transaction.id, reason), "Transaction returned for correction.");
  };

  const cancel = (transaction: FinanceTransaction) => {
    const reason = window.prompt("Why is this unapproved transaction being cancelled?");
    if (reason === null) return;
    void runAction(transaction, () => api.finance.cancel(transaction.id, reason), "Transaction cancelled. Its history was preserved.");
  };

  const reverse = (transaction: FinanceTransaction) => {
    const reason = window.prompt("Why must this approved transaction be reversed?");
    if (reason === null) return;
    void runAction(transaction, () => api.finance.reverse(transaction.id, reason), "Approved reversal created. The original record remains unchanged.");
  };

  const exportCsv = async () => {
    try {
      setError("");
      const blob = await api.finance.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `scoutos-finance-${today()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not export finance transactions.");
    }
  };

  const uploadAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editing) return;
    try {
      setAttachmentBusy(true);
      setError("");
      const { attachment } = await api.finance.uploadAttachment(editing.id, file);
      setAttachments((current) => [...current, attachment]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload this receipt.");
    } finally {
      setAttachmentBusy(false);
    }
  };

  const downloadAttachment = async (attachment: FinanceAttachment) => {
    try {
      setAttachmentBusy(true);
      setError("");
      const blob = await api.finance.downloadAttachment(attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download this receipt.");
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeAttachment = async (attachment: FinanceAttachment) => {
    if (!window.confirm(`Remove “${attachment.filename}” from this draft?`)) return;
    try {
      setAttachmentBusy(true);
      setError("");
      await api.finance.removeAttachment(attachment.id);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove this receipt.");
    } finally {
      setAttachmentBusy(false);
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
        <div className="finance-header-actions">
          <button className="button button-secondary" onClick={() => { void exportCsv(); }} type="button">Export CSV</button>
          <button className="button button-primary" onClick={openCreate} type="button"><Icon name="plus" size={18} />Add transaction</button>
        </div>
      </header>

      {error && <div className="form-error finance-error">{error}</div>}
      {notice && <div className="page-success">{notice}</div>}

      <section className="metrics-grid finance-metrics" aria-label="Financial dashboard">
        <article className={`metric-card finance-balance-card ${summary.balance < 0 ? "is-debt" : summary.balance > 0 ? "is-positive" : "is-even"}`} aria-live="polite"><span className="metric-icon"><Icon name="wallet" size={22} /></span><div><p>{scopeLabel}</p><strong>{formatMoney(Math.abs(summary.balance))}</strong><small>{balanceLabel}</small></div><p className="finance-balance-description">{balanceDescription}</p></article>
        <article className="metric-card"><span className="metric-icon green"><Icon name="wallet" size={22} /></span><div><p>Total income</p><strong>{formatMoney(summary.totalIncome)}</strong><small>Approved only</small></div></article>
        <article className="metric-card"><span className="metric-icon gold"><Icon name="calendar" size={22} /></span><div><p>Total expenses</p><strong>{formatMoney(summary.totalExpenses)}</strong><small>Approved only</small></div></article>
        <article className="metric-card"><span className="metric-icon blue"><Icon name="events" size={22} /></span><div><p>Debt</p><strong>{formatMoney(summary.debt)}</strong><small>{summary.debt > 0 ? "Deficit to resolve" : "No debt recorded"}</small></div></article>
        <article className="metric-card"><span className="metric-icon green"><Icon name="folder" size={22} /></span><div><p>Submitted</p><strong>{summary.pending}</strong><small>Awaiting Admin approval</small></div></article>
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
          {transactions.map((transaction) => {
            const editable = transaction.status === "DRAFT" || transaction.status === "REJECTED";
            const busy = actionBusyId === transaction.id;
            return <tr key={transaction.id}>
              <td>{formatDate(transaction.transactionDate)}</td>
              <td><strong>{transaction.description}</strong><span className="finance-subtle">{transaction.reversalOfId ? `Reverses #${transaction.reversalOfId}` : transaction.vendorPaidTo || transaction.referenceNumber || "No vendor or reference"}</span></td>
              <td><span className="unit-pill" dir="rtl">{transaction.unit}</span></td>
              <td><span className={`finance-type ${transaction.transactionType.toLowerCase()}`}>{titleCase(transaction.transactionType)}</span></td>
              <td>{transaction.category}</td>
              <td><strong>{formatMoney(transaction.amount)}</strong><span className="finance-subtle">{transaction.paymentMethod}</span></td>
              <td><span className={`finance-status ${transaction.status.toLowerCase()}`}>{titleCase(transaction.status)}</span></td>
              <td><div className="table-actions finance-row-actions">
                <button aria-label={`View ${transaction.description}`} disabled={busy} title="View" type="button" onClick={() => openTransaction(transaction, true)}><Icon name="eye" size={16} /></button>
                {editable && <button aria-label={`Edit ${transaction.description}`} disabled={busy} title="Edit draft" type="button" onClick={() => openTransaction(transaction, false)}><Icon name="edit" size={16} /></button>}
                {editable && <button className="finance-action-button" disabled={busy} onClick={() => { void submitForApproval(transaction); }} type="button">Submit</button>}
                {canApprove && transaction.status === "SUBMITTED" && <button className="finance-action-button approve" disabled={busy} onClick={() => approve(transaction)} type="button">Approve</button>}
                {canApprove && transaction.status === "SUBMITTED" && <button className="finance-action-button" disabled={busy} onClick={() => reject(transaction)} type="button">Reject</button>}
                {["DRAFT", "SUBMITTED", "REJECTED"].includes(transaction.status) && <button className="danger" aria-label={`Cancel ${transaction.description}`} disabled={busy} title="Cancel and preserve history" type="button" onClick={() => cancel(transaction)}><Icon name="x" size={16} /></button>}
                {canApprove && transaction.status === "APPROVED" && !transaction.reversalOfId && !transaction.reversingTransactionId && <button className="finance-action-button" disabled={busy} onClick={() => reverse(transaction)} type="button">Reverse</button>}
              </div></td>
            </tr>;
          })}
        </tbody></table></div>
        {loading && <div className="empty-state"><p>Loading financial transactions...</p></div>}
        {!loading && transactions.length === 0 && <div className="empty-state"><span><Icon name="wallet" size={25} /></span><h3>No transactions found</h3><p>Adjust the filters or record the first transaction in your permitted scope.</p><button className="button button-primary empty-state-button" type="button" onClick={openCreate}><Icon name="plus" size={17} />Add transaction</button></div>}
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <div className="modal finance-modal" role="dialog" aria-modal="true" aria-labelledby="finance-form-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><span className="eyebrow">{readOnly ? "Transaction details" : editing ? "Correct draft" : "New financial record"}</span><h2 id="finance-form-title">{readOnly ? "View transaction" : editing ? "Edit transaction" : "Add transaction"}</h2></div>
              <button className="round-button" aria-label="Close" disabled={saving} onClick={closeModal} type="button"><Icon name="x" size={18} /></button>
            </div>
            {error && <div className="form-error">{error}</div>}
            {editing && <div className="finance-current-state"><span className={`finance-status ${editing.status.toLowerCase()}`}>{titleCase(editing.status)}</span><small>{editing.reversalOfId ? `Approved reversal of #${editing.reversalOfId}` : editing.reversingTransactionId ? `Reversed by #${editing.reversingTransactionId}` : "Status changes are recorded permanently."}</small></div>}
            {!editing && <div className="finance-current-state"><span className="finance-status draft">Draft</span><small>New records start as drafts and do not affect the balance until approved.</small></div>}
            <form className="scout-form finance-form" onSubmit={saveTransaction}>
              <fieldset disabled={readOnly || saving}>
                <label className="field"><span>Transaction type</span><select value={form.transactionType} onChange={(event) => setForm({ ...form, transactionType: event.target.value as FinanceTransactionType })}>{financeTransactionTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></label>
                <label className="field"><span>Unit</span>{unitLocked ? <input disabled value={user?.unit || ""} /> : <select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value as ScoutUnit })}>{scoutUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>}</label>
                <label className="field"><span>Transaction date</span><input required type="date" value={form.transactionDate} onChange={(event) => setForm({ ...form, transactionDate: event.target.value })} /></label>
                <label className="field"><span>Category</span><input required list="finance-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /><datalist id="finance-categories">{availableCategories.map((category) => <option key={category} value={category} />)}</datalist></label>
                <label className="field"><span>Amount (JOD)</span><input required min="0.01" step="0.01" type="number" value={form.amount || ""} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} /></label>
                <label className="field field-wide"><span>Description</span><input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What was this transaction for?" /></label>
                <label className="field"><span>Vendor / paid to</span><input value={form.vendorPaidTo} onChange={(event) => setForm({ ...form, vendorPaidTo: event.target.value })} placeholder="Supplier or recipient" /></label>
                <label className="field"><span>Payment method</span><select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as FinanceTransactionInput["paymentMethod"] })}>{financePaymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
                <label className="field field-wide"><span>Reference number</span><input value={form.referenceNumber} onChange={(event) => setForm({ ...form, referenceNumber: event.target.value })} placeholder="Invoice, receipt, or transfer reference" /></label>
                <label className="field field-wide"><span>Notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional internal notes" /></label>
              </fieldset>
              {editing && <div className="finance-audit">
                <div><span>Created by</span><strong>{editing.createdBy?.fullName || "Former ScoutOS user"}</strong><small>{formatTimestamp(editing.createdAt)}</small></div>
                <div><span>Last updated by</span><strong>{editing.updatedBy?.fullName || "Former ScoutOS user"}</strong><small>{formatTimestamp(editing.updatedAt)}</small></div>
                <div><span>Approved by</span><strong>{editing.approvedBy?.fullName || "Not approved"}</strong><small>{editing.approvedAt ? formatTimestamp(editing.approvedAt) : "—"}</small></div>
              </div>}
              {editing?.rejectionReason && <div className="finance-rejection"><strong>Rejection reason</strong><p>{editing.rejectionReason}</p></div>}
              {editing && <section className="finance-attachments">
                <div className="finance-section-heading"><div><h3>Receipt files</h3><p>PDF, JPEG, or PNG · 5 MB maximum · up to 5 files</p></div>{["DRAFT", "REJECTED"].includes(editing.status) && <label className="button button-secondary finance-upload-button"><input accept="application/pdf,image/jpeg,image/png" disabled={attachmentBusy || attachments.length >= 5} onChange={uploadAttachment} type="file" />{attachmentBusy ? "Working…" : "Add receipt"}</label>}</div>
                {attachments.length === 0 ? <p className="finance-section-empty">No receipt files attached.</p> : <div className="finance-attachment-list">{attachments.map((attachment) => <div key={attachment.id}><span><strong>{attachment.filename}</strong><small>{formatFileSize(attachment.fileSize)} · {attachment.uploadedBy?.fullName || "Former ScoutOS user"}</small></span><button disabled={attachmentBusy} onClick={() => { void downloadAttachment(attachment); }} type="button">Download</button>{["DRAFT", "REJECTED"].includes(editing.status) && <button className="danger" disabled={attachmentBusy} onClick={() => { void removeAttachment(attachment); }} type="button">Remove</button>}</div>)}</div>}
              </section>}
              {editing && <section className="finance-history"><h3>Status history</h3>{history.length === 0 ? <p>Loading history…</p> : history.map((entry) => <div key={entry.id}><span className={`finance-status ${entry.toStatus.toLowerCase()}`}>{titleCase(entry.toStatus)}</span><p>{entry.reason || "Status updated"}</p><small>{entry.changedBy?.fullName || "System"} · {formatTimestamp(entry.createdAt)}</small></div>)}</section>}
              <div className="form-actions field-wide"><button className="button button-secondary" disabled={saving} type="button" onClick={closeModal}>{readOnly ? "Close" : "Cancel"}</button>{!readOnly && <button className="button button-primary" disabled={saving} type="submit"><Icon name="check" size={18} />{saving ? "Saving..." : editing ? "Save draft" : "Create draft"}</button>}</div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Finance;
