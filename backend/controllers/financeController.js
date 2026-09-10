import {
  createTransaction,
  deleteTransaction,
  getFinanceSummary,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "../services/financeService.js";

function errorStatus(error) {
  return Number.isInteger(Number(error.status)) ? Number(error.status) : 500;
}

async function run(response, send, action) {
  try {
    await action();
  } catch (error) {
    console.error("Finance error:", error);
    send(response, errorStatus(error), { error: error.message || "Finance request failed." });
  }
}

function filtersFromRequest(request) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  return Object.fromEntries(url.searchParams.entries());
}

export async function listFinanceTransactions(request, response, context) {
  await run(response, context.send, async () => context.send(response, 200, {
    transactions: await listTransactions(context.user, filtersFromRequest(request)),
  }));
}

export async function financeSummary(request, response, context) {
  await run(response, context.send, async () => context.send(response, 200, {
    summary: await getFinanceSummary(context.user, filtersFromRequest(request)),
  }));
}

export async function getFinanceTransaction(_request, response, context, id) {
  await run(response, context.send, async () => context.send(response, 200, {
    transaction: await getTransaction(id, context.user),
  }));
}

export async function createFinanceTransaction(request, response, context) {
  await run(response, context.send, async () => context.send(response, 201, {
    transaction: await createTransaction(await context.readJson(request), context.user),
  }));
}

export async function updateFinanceTransaction(request, response, context, id) {
  await run(response, context.send, async () => context.send(response, 200, {
    transaction: await updateTransaction(id, await context.readJson(request), context.user),
  }));
}

export async function deleteFinanceTransaction(_request, response, context, id) {
  await run(response, context.send, async () => {
    await deleteTransaction(id, context.user);
    context.sendNoContent(response);
  });
}
