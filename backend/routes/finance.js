import {
  approveFinanceTransaction,
  cancelFinanceTransaction,
  createFinanceTransaction,
  deleteFinanceAttachment,
  downloadFinanceAttachment,
  exportFinanceTransactions,
  financeSummary,
  financeTransactionHistory,
  getFinanceTransaction,
  listFinanceTransactionAttachments,
  listFinanceTransactions,
  rejectFinanceTransaction,
  reverseFinanceTransaction,
  submitFinanceTransaction,
  updateFinanceTransaction,
  uploadFinanceTransactionAttachment,
} from "../controllers/financeController.js";

export async function handleFinanceRoute(request, response, context) {
  const { path } = context;
  if (!path.startsWith("/api/finance")) return false;

  if (request.method === "GET" && path === "/api/finance/transactions") {
    await listFinanceTransactions(request, response, context);
    return true;
  }
  if (request.method === "POST" && path === "/api/finance/transactions") {
    await createFinanceTransaction(request, response, context);
    return true;
  }
  if (request.method === "GET" && path === "/api/finance/summary") {
    await financeSummary(request, response, context);
    return true;
  }

  if (request.method === "GET" && path === "/api/finance/export.csv") {
    await exportFinanceTransactions(request, response, context);
    return true;
  }

  const attachmentMatch = path.match(/^\/api\/finance\/attachments\/(\d+)$/);
  if (attachmentMatch) {
    if (request.method === "GET") await downloadFinanceAttachment(request, response, context, attachmentMatch[1]);
    else if (request.method === "DELETE") await deleteFinanceAttachment(request, response, context, attachmentMatch[1]);
    else return false;
    return true;
  }

  const transactionAttachmentsMatch = path.match(/^\/api\/finance\/transactions\/(\d+)\/attachments$/);
  if (transactionAttachmentsMatch) {
    if (request.method === "GET") await listFinanceTransactionAttachments(request, response, context, transactionAttachmentsMatch[1]);
    else if (request.method === "POST") await uploadFinanceTransactionAttachment(request, response, context, transactionAttachmentsMatch[1]);
    else return false;
    return true;
  }

  const historyMatch = path.match(/^\/api\/finance\/transactions\/(\d+)\/history$/);
  if (historyMatch && request.method === "GET") {
    await financeTransactionHistory(request, response, context, historyMatch[1]);
    return true;
  }

  const actionMatch = path.match(/^\/api\/finance\/transactions\/(\d+)\/(submit|approve|reject|cancel|reverse)$/);
  if (actionMatch && request.method === "POST") {
    const [, id, action] = actionMatch;
    if (action === "submit") await submitFinanceTransaction(request, response, context, id);
    else if (action === "approve") await approveFinanceTransaction(request, response, context, id);
    else if (action === "reject") await rejectFinanceTransaction(request, response, context, id);
    else if (action === "cancel") await cancelFinanceTransaction(request, response, context, id);
    else await reverseFinanceTransaction(request, response, context, id);
    return true;
  }

  const match = path.match(/^\/api\/finance\/transactions\/(\d+)$/);
  if (match) {
    if (request.method === "GET") await getFinanceTransaction(request, response, context, match[1]);
    else if (request.method === "PUT") await updateFinanceTransaction(request, response, context, match[1]);
    else if (request.method === "DELETE") await cancelFinanceTransaction(request, response, context, match[1]);
    else return false;
    return true;
  }

  context.send(response, 404, { error: "Finance route not found." });
  return true;
}
