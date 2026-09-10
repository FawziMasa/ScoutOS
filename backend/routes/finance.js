import {
  createFinanceTransaction,
  deleteFinanceTransaction,
  financeSummary,
  getFinanceTransaction,
  listFinanceTransactions,
  updateFinanceTransaction,
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

  const match = path.match(/^\/api\/finance\/transactions\/(\d+)$/);
  if (match) {
    if (request.method === "GET") await getFinanceTransaction(request, response, context, match[1]);
    else if (request.method === "PUT") await updateFinanceTransaction(request, response, context, match[1]);
    else if (request.method === "DELETE") await deleteFinanceTransaction(request, response, context, match[1]);
    else return false;
    return true;
  }

  context.send(response, 404, { error: "Finance route not found." });
  return true;
}
