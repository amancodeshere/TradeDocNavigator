import { randomUUID } from "node:crypto";
import { db, transaction } from "../connect.js";
import { assert, text, date, decimal } from "./errors.js";
import { orderFromXML } from "./xml.js";

function normalizeDocument(input) {
  const buyer = text(input.PartyName, "Buyer name");
  const issueDate = date(input.IssueDate);
  const currency = text(input.CurrencyCode, "Currency code", 3).toUpperCase();
  assert(
    /^[A-Z]{3}$/.test(currency),
    "Currency must be a three-letter code, such as AUD.",
  );
  assert(
    Array.isArray(input.Items) &&
      input.Items.length > 0 &&
      input.Items.length <= 100,
    "Add between 1 and 100 invoice items.",
  );
  const items = input.Items.map((item) => ({
    name: text(item.ItemName, "Item name"),
    description: text(
      item.ItemDescription || item.ItemName,
      "Item description",
      1000,
    ),
    price: decimal(item.ItemPrice, "Unit price"),
    quantity: decimal(item.ItemQuantity, "Quantity", 0.001, 3),
    unit: text(item.ItemUnitCode || "EA", "Unit", 3).toUpperCase(),
  }));
  assert(
    items.every((item) => /^[A-Z]{2,3}$/.test(item.unit)),
    "Use a valid unit code, such as EA or KGM.",
  );
  const total =
    input.PayableAmount === undefined
      ? items
          .reduce((sum, item) => sum + item.price * item.quantity, 0)
          .toFixed(2)
      : input.PayableAmount;
  return {
    buyer,
    issueDate,
    currency,
    items,
    total: decimal(total, "Payable amount"),
  };
}
export async function createInvoice(user, input, isXML = false) {
  const document = normalizeDocument(isXML ? orderFromXML(input) : input);
  return transaction(async (client) => {
    const orderId = randomUUID();
    await client.query(
      `INSERT INTO orders (salesorderid, uuid, issuedate, partynamebuyer, partynameseller, payableamount, payablecurrencycode)
      VALUES ($1,$1,$2,$3,$4,$5,$6)`,
      [
        orderId,
        document.issueDate,
        document.buyer,
        user.companyName,
        document.total,
        document.currency,
      ],
    );
    const { rows } = await client.query(
      `INSERT INTO invoices (userid, issuedate, partynameseller, partynamebuyer, currencycode, salesorderid, payableamount)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING invoiceid`,
      [
        user.userId,
        document.issueDate,
        user.companyName,
        document.buyer,
        document.currency,
        orderId,
        document.total,
      ],
    );
    const invoiceId = rows[0].invoiceid;
    for (const [index, item] of document.items.entries()) {
      const { rows: orderItems } = await client.query(
        `INSERT INTO order_items (orderitemid, salesorderid, itemname, itemdescription, itemprice, itemquantity, itemunitcode)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING itemid`,
        [
          String(index + 1),
          orderId,
          item.name,
          item.description,
          item.price,
          item.quantity,
          item.unit,
        ],
      );
      await client.query(
        `INSERT INTO invoice_items (invoiceid, invoiceitemname, itemdescription, sellersitemidentification, itemprice, itemquantity, itemunitcode)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          invoiceId,
          item.name,
          item.description,
          orderItems[0].itemid,
          item.price,
          item.quantity,
          item.unit,
        ],
      );
    }
    return { invoiceId };
  });
}
const summary = (row) => ({
  invoiceId: row.invoiceid,
  issueDate: row.issue_date,
  partyNameBuyer: row.partynamebuyer,
  partyNameSeller: row.partynameseller,
  currencyCode: row.currencycode,
  amount: Number(row.payableamount),
  payableAmount: `${row.currencycode} ${Number(row.payableamount).toFixed(2)}`,
  salesOrderId: row.salesorderid,
});
const select =
  "SELECT *, to_char(issuedate, 'YYYY-MM-DD') AS issue_date FROM invoices";
export async function listInvoices(user, buyer = "") {
  assert(
    typeof buyer === "string" && buyer.length <= 200,
    "Buyer filter must be at most 200 characters.",
  );
  const { rows } = await db.query(
    `${select} WHERE userid = $1 AND ($2 = '' OR position(lower($2) in lower(partynamebuyer)) > 0) ORDER BY invoiceid DESC LIMIT 500`,
    [user.userId, buyer.trim()],
  );
  return { invoices: rows.map(summary) };
}
export async function getInvoice(user, invoiceId) {
  assert(
    /^\d+$/.test(String(invoiceId)) &&
      Number(invoiceId) > 0 &&
      Number(invoiceId) <= 2147483647,
    "Invoice not found.",
    404,
  );
  const { rows } = await db.query(
    `${select} WHERE invoiceid = $1 AND userid = $2`,
    [invoiceId, user.userId],
  );
  assert(rows.length, "Invoice not found.", 404);
  const { rows: items } = await db.query(
    "SELECT * FROM invoice_items WHERE invoiceid = $1 ORDER BY invoiceitemid",
    [invoiceId],
  );
  return {
    ...summary(rows[0]),
    items: items.map((item) => ({
      name: item.invoiceitemname,
      description: item.itemdescription,
      price: Number(item.itemprice),
      quantity: Number(item.itemquantity),
      unit: item.itemunitcode,
    })),
  };
}
export async function updateInvoice(user, invoiceId, body) {
  assert(
    /^\d+$/.test(String(invoiceId)) &&
      Number(invoiceId) > 0 &&
      Number(invoiceId) <= 2147483647,
    "Invoice not found.",
    404,
  );
  // Compatibility with the old single-field update endpoint.
  if (body.toUpdate) {
    const fields = {
      PayableAmount: "amount",
      IssueDate: "issueDate",
      CurrencyCode: "currencyCode",
    };
    assert(fields[body.toUpdate], "Invalid field for update.");
    body = { [fields[body.toUpdate]]: body.newData };
  }
  assert(
    body.amount !== undefined ||
      body.issueDate !== undefined ||
      body.currencyCode !== undefined,
    "Provide an amount, date or currency to update.",
  );
  const amount =
    body.amount === undefined ? null : decimal(body.amount, "Payable amount");
  const issueDate = body.issueDate === undefined ? null : date(body.issueDate);
  const currency =
    body.currencyCode === undefined
      ? null
      : text(body.currencyCode, "Currency", 3).toUpperCase();
  assert(
    currency === null || /^[A-Z]{3}$/.test(currency),
    "Use a three-letter currency code.",
  );
  return transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE invoices SET payableamount = COALESCE($1,payableamount), issuedate = COALESCE($2::date,issuedate), currencycode = COALESCE($3,currencycode)
      WHERE invoiceid = $4 AND userid = $5 RETURNING salesorderid, payableamount, issuedate, currencycode`,
      [amount, issueDate, currency, invoiceId, user.userId],
    );
    assert(rows.length, "Invoice not found.", 404);
    await client.query(
      "UPDATE orders SET payableamount=$1, issuedate=$2, payablecurrencycode=$3 WHERE salesorderid=$4",
      [
        rows[0].payableamount,
        rows[0].issuedate,
        rows[0].currencycode,
        rows[0].salesorderid,
      ],
    );
    return { message: "Invoice updated successfully." };
  });
}
