import { randomUUID } from "node:crypto";
import { db } from "../connect.js";
import { assert, text, date, decimal } from "./errors.js";

const select =
  "SELECT *, to_char(issue_date, 'YYYY-MM-DD') AS date_text FROM despatch_advices";
const model = (row) => ({
  despatchId: row.id,
  orderId: row.order_id,
  issueDate: row.date_text,
  supplierName: row.supplier_name,
  customerName: row.customer_name,
  deliveryAddress: row.delivery_address,
  countryCode: row.country_code,
  status: row.status,
  items: row.items,
});
export async function listDespatches(user) {
  const { rows } = await db.query(
    `${select} WHERE userid=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 500`,
    [user.userId],
  );
  return { despatches: rows.map(model) };
}
export async function getDespatch(user, id) {
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    "Despatch advice not found.",
    404,
  );
  const { rows } = await db.query(
    `${select} WHERE id=$1 AND userid=$2 AND deleted_at IS NULL`,
    [id, user.userId],
  );
  assert(rows.length, "Despatch advice not found.", 404);
  return model(rows[0]);
}
export async function createDespatch(user, body) {
  const orderId = text(body.orderId, "Order reference");
  const issueDate = date(body.issueDate);
  const supplier = text(body.supplierName, "Supplier name");
  const customer = text(body.customerName, "Customer name");
  const address = text(body.deliveryAddress, "Delivery address", 1000);
  const country = text(body.countryCode, "Country code", 2).toUpperCase();
  assert(
    /^[A-Z]{2}$/.test(country),
    "Use a two-letter destination country code, such as AU.",
  );
  assert(
    Array.isArray(body.items) &&
      body.items.length > 0 &&
      body.items.length <= 100,
    "Add between 1 and 100 items.",
  );
  const items = body.items.map((item) => ({
    itemId: text(item.itemId, "Item reference"),
    description: text(item.description, "Description", 1000),
    quantity: decimal(item.quantity, "Quantity", 0.001, 3),
    unit: text(item.unit, "Unit", 3).toUpperCase(),
  }));
  assert(
    items.every((item) => /^[A-Z]{2,3}$/.test(item.unit)),
    "Use a valid unit code, such as EA or KGM.",
  );
  const id = randomUUID();
  await db.query(
    `INSERT INTO despatch_advices (id,userid,order_id,issue_date,supplier_name,customer_name,delivery_address,country_code,items)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      user.userId,
      orderId,
      issueDate,
      supplier,
      customer,
      address,
      country,
      JSON.stringify(items),
    ],
  );
  return { despatchId: id };
}
export async function deleteDespatch(user, id) {
  await getDespatch(user, id);
  await db.query(
    "UPDATE despatch_advices SET deleted_at=now() WHERE id=$1 AND userid=$2",
    [id, user.userId],
  );
  return { message: "Despatch advice removed.", despatchId: id };
}
export async function restoreDespatch(user, id) {
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    "Despatch advice not found.",
    404,
  );
  const { rowCount } = await db.query(
    "UPDATE despatch_advices SET deleted_at=NULL WHERE id=$1 AND userid=$2 AND deleted_at IS NOT NULL",
    [id, user.userId],
  );
  assert(rowCount, "Despatch advice not found.", 404);
  return { message: "Despatch advice restored." };
}
