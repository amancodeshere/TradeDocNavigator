CREATE TABLE IF NOT EXISTS users (
  userid SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
  companyname TEXT NOT NULL, numlogins INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized ON users (lower(email));
CREATE TABLE IF NOT EXISTS sessions (
  sessionid SERIAL PRIMARY KEY, userid INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
  createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP, valid BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash ON sessions (token_hash);
CREATE TABLE IF NOT EXISTS orders (
  salesorderid TEXT PRIMARY KEY, uuid TEXT NOT NULL, issuedate DATE NOT NULL,
  partynamebuyer TEXT NOT NULL, partynameseller TEXT NOT NULL,
  payableamount NUMERIC(18,2) NOT NULL, payablecurrencycode TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  itemid SERIAL PRIMARY KEY, orderitemid TEXT NOT NULL,
  salesorderid TEXT NOT NULL REFERENCES orders(salesorderid) ON DELETE CASCADE,
  itemname TEXT NOT NULL, itemdescription TEXT NOT NULL, itemprice NUMERIC(18,2) NOT NULL,
  itemquantity NUMERIC(18,3) NOT NULL, itemunitcode TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  invoiceid SERIAL PRIMARY KEY, issuedate DATE NOT NULL, partynameseller TEXT NOT NULL,
  partynamebuyer TEXT NOT NULL, currencycode TEXT NOT NULL,
  invoicestartdate DATE, invoiceenddate DATE,
  salesorderid TEXT NOT NULL REFERENCES orders(salesorderid) ON DELETE CASCADE
);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS userid INTEGER REFERENCES users(userid);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payableamount NUMERIC(18,2);
UPDATE invoices i SET payableamount = o.payableamount FROM orders o
  WHERE i.salesorderid = o.salesorderid AND i.payableamount IS NULL;
-- Only adopt historical documents when there is exactly one matching seller account.
UPDATE invoices i SET userid = u.userid FROM users u
  WHERE i.userid IS NULL AND i.partynameseller = u.companyname
  AND (SELECT count(*) FROM users u2 WHERE u2.companyname = i.partynameseller) = 1;
CREATE INDEX IF NOT EXISTS invoices_owner ON invoices (userid, invoiceid);
CREATE TABLE IF NOT EXISTS invoice_items (
  invoiceitemid SERIAL PRIMARY KEY,
  invoiceid INTEGER NOT NULL REFERENCES invoices(invoiceid) ON DELETE CASCADE,
  invoiceitemname TEXT NOT NULL, itemdescription TEXT NOT NULL,
  sellersitemidentification INTEGER NOT NULL,
  itemprice NUMERIC(18,2) NOT NULL, itemquantity NUMERIC(18,3) NOT NULL, itemunitcode TEXT NOT NULL
);
ALTER TABLE order_items ALTER COLUMN itemprice TYPE NUMERIC(18,2) USING itemprice::numeric;
ALTER TABLE order_items ALTER COLUMN itemquantity TYPE NUMERIC(18,3) USING itemquantity::numeric;
ALTER TABLE invoice_items ALTER COLUMN itemprice TYPE NUMERIC(18,2) USING itemprice::numeric;
ALTER TABLE invoice_items ALTER COLUMN itemquantity TYPE NUMERIC(18,3) USING itemquantity::numeric;
CREATE TABLE IF NOT EXISTS despatch_advices (
  id UUID PRIMARY KEY, userid INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
  order_id TEXT NOT NULL, issue_date DATE NOT NULL, supplier_name TEXT NOT NULL,
  customer_name TEXT NOT NULL, delivery_address TEXT NOT NULL, country_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Prepared', items JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS despatch_owner ON despatch_advices (userid, created_at);
CREATE TABLE IF NOT EXISTS tracked_shipments (
  id UUID PRIMARY KEY, userid INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL, tracking_provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Awaiting update', data JSONB NOT NULL DEFAULT '{}',
  synced_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (userid, tracking_number, tracking_provider)
);
