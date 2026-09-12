import {
  approveTransaction,
  cancelTransaction,
  createTransaction,
  exportTransactionsCsv,
  getFinanceSummary,
  getTransaction,
  listTransactionHistory,
  listTransactions,
  rejectTransaction,
  reverseTransaction,
  submitTransaction,
  updateTransaction,
} from "../services/financeService.js";

function errorStatus(error) {
  if (error?.code === "ER_DUP_ENTRY") return 409;
  return Number.isInteger(Number(error.status)) ? Number(error.status) : 500;
}

async function run(response, send, action) {
  try {
    await action();
  } catch (error) {
    const status = errorStatus(error);
    console.error("Finance request failed.", {
      code: String(error?.code || "FINANCE_REQUEST_FAILED").slice(0, 80),
      status,
    });
    send(response, status, {
      error: status < 500 ? error.message : "ScoutOS could not complete the Finance request.",
    });
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

export async function submitFinanceTransaction(_request, response, context, id) {
  await run(response, context.send, async () => context.send(response, 200, {
    transaction: await submitTransaction(id, context.user),
  }));
}

export async function approveFinanceTransaction(_request, response, context, id) {
  await run(response, context.send, async () => context.send(response, 200, {
    transaction: await approveTransaction(id, context.user),
  }));
}

export async function rejectFinanceTransaction(request, response, context, id) {
  await run(response, context.send, async () => {
    const body = await context.readJson(request);
    context.send(response, 200, { transaction: await rejectTransaction(id, body.reason, context.user) });
  });
}

export async function cancelFinanceTransaction(request, response, context, id) {
  await run(response, context.send, async () => {
    const body = await context.readJson(request);
    context.send(response, 200, { transaction: await cancelTransaction(id, body.reason, context.user) });
  });
}

export async function reverseFinanceTransaction(request, response, context, id) {
  await run(response, context.send, async () => {
    const body = await context.readJson(request);
    context.send(response, 201, { transaction: await reverseTransaction(id, body.reason, context.user) });
  });
}

export async function financeTransactionHistory(_request, response, context, id) {
  await run(response, context.send, async () => context.send(response, 200, {
    history: await listTransactionHistory(id, context.user),
  }));
}

export async function exportFinanceTransactions(request, response, context) {
  await run(response, context.send, async () => {
    const csv = await exportTransactionsCsv(context.user, filtersFromRequest(request));
    response.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scoutos-finance.csv"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(csv);
  });
}
