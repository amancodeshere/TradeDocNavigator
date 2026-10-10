import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";
import xsdValidator from "xsd-schema-validator";
import { fileURLToPath } from "node:url";
import { assert } from "./errors.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
});
const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressEmptyNode: true,
});
export function parseXML(xml) {
  assert(
    typeof xml === "string" && xml.length > 0 && xml.length <= 500000,
    "Paste an XML document up to 500 KB.",
  );
  assert(
    !/<!DOCTYPE|<!ENTITY/i.test(xml),
    "XML document types and custom entities are not supported.",
  );
  const validation = XMLValidator.validate(xml);
  assert(
    validation === true,
    validation === true ? "" : `Invalid XML: ${validation.err.msg}`,
  );
  return parser.parse(xml);
}
const value = (node) => (typeof node === "object" ? node?.["#text"] : node);
export function orderFromXML(xml) {
  const root = parseXML(xml).Order;
  assert(root, "The XML must contain a UBL Order document.");
  const lines = Array.isArray(root.OrderLine)
    ? root.OrderLine
    : [root.OrderLine];
  const amount = root.AnticipatedMonetaryTotal?.PayableAmount;
  return {
    IssueDate: root.IssueDate,
    PartyName: root.BuyerCustomerParty?.Party?.PartyName?.Name,
    CurrencyCode: amount?.["@_currencyID"] || root.DocumentCurrencyCode,
    PayableAmount: value(amount),
    Items: lines.map((line) => ({
      ItemName: line?.LineItem?.Item?.Name,
      ItemDescription:
        line?.LineItem?.Item?.Description || line?.LineItem?.Item?.Name,
      ItemPrice: value(line?.LineItem?.Price?.PriceAmount),
      ItemQuantity: value(line?.LineItem?.Quantity),
      ItemUnitCode: line?.LineItem?.Quantity?.["@_unitCode"] || "EA",
    })),
  };
}
const namespaces = (type) => ({
  "@_xmlns": `urn:oasis:names:specification:ubl:schema:xsd:${type}-2`,
  "@_xmlns:cac":
    "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  "@_xmlns:cbc":
    "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
});
const amount = (value, currency) => ({
  "@_currencyID": currency,
  "#text": Number(value).toFixed(2),
});
const party = (name) => ({
  "cac:Party": { "cac:PartyName": { "cbc:Name": name } },
});
export function invoiceXML(invoice) {
  const lineTotal = invoice.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  // Explicit allowance/charge preserves imported order totals without silently altering line prices.
  const adjustment = Number((invoice.amount - lineTotal).toFixed(2));
  const root = {
    ...namespaces("Invoice"),
    "cbc:UBLVersionID": "2.1",
    "cbc:ID": String(invoice.invoiceId),
    "cbc:IssueDate": invoice.issueDate,
    "cbc:InvoiceTypeCode": "380",
    "cbc:DocumentCurrencyCode": invoice.currencyCode,
    "cac:OrderReference": { "cbc:ID": invoice.salesOrderId },
    "cac:AccountingSupplierParty": party(invoice.partyNameSeller),
    "cac:AccountingCustomerParty": party(invoice.partyNameBuyer),
    ...(adjustment
      ? {
          "cac:AllowanceCharge": {
            "cbc:ChargeIndicator": adjustment > 0 ? "true" : "false",
            "cbc:AllowanceChargeReason": "Order total adjustment",
            "cbc:Amount": amount(Math.abs(adjustment), invoice.currencyCode),
          },
        }
      : {}),
    "cac:LegalMonetaryTotal": {
      "cbc:LineExtensionAmount": amount(lineTotal, invoice.currencyCode),
      "cbc:TaxExclusiveAmount": amount(invoice.amount, invoice.currencyCode),
      "cbc:TaxInclusiveAmount": amount(invoice.amount, invoice.currencyCode),
      ...(adjustment < 0
        ? {
            "cbc:AllowanceTotalAmount": amount(
              -adjustment,
              invoice.currencyCode,
            ),
          }
        : {}),
      ...(adjustment > 0
        ? { "cbc:ChargeTotalAmount": amount(adjustment, invoice.currencyCode) }
        : {}),
      "cbc:PayableAmount": amount(invoice.amount, invoice.currencyCode),
    },
    "cac:InvoiceLine": invoice.items.map((item, index) => ({
      "cbc:ID": String(index + 1),
      "cbc:InvoicedQuantity": {
        "@_unitCode": item.unit,
        "#text": item.quantity,
      },
      "cbc:LineExtensionAmount": amount(
        item.price * item.quantity,
        invoice.currencyCode,
      ),
      "cac:Item": {
        "cbc:Description": item.description,
        "cbc:Name": item.name,
      },
      "cac:Price": {
        "cbc:PriceAmount": amount(item.price, invoice.currencyCode),
      },
    })),
  };
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    builder.build({ Invoice: root })
  );
}
export function despatchXML(despatch) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    builder.build({
      DespatchAdvice: {
        ...namespaces("DespatchAdvice"),
        "cbc:UBLVersionID": "2.1",
        "cbc:ID": despatch.despatchId,
        "cbc:IssueDate": despatch.issueDate,
        "cac:OrderReference": { "cbc:ID": despatch.orderId },
        "cac:DespatchSupplierParty": party(despatch.supplierName),
        "cac:DeliveryCustomerParty": party(despatch.customerName),
        "cac:Shipment": {
          "cbc:ID": despatch.despatchId,
          "cac:Delivery": {
            "cac:DeliveryAddress": {
              "cac:AddressLine": { "cbc:Line": despatch.deliveryAddress },
              "cac:Country": { "cbc:IdentificationCode": despatch.countryCode },
            },
          },
        },
        "cac:DespatchLine": despatch.items.map((item, index) => ({
          "cbc:ID": String(index + 1),
          "cbc:DeliveredQuantity": {
            "@_unitCode": item.unit,
            "#text": item.quantity,
          },
          "cac:OrderLineReference": { "cbc:LineID": item.itemId },
          "cac:Item": {
            "cbc:Description": item.description,
            "cbc:Name": item.itemId,
          },
        })),
      },
    })
  );
}
let validationQueue = Promise.resolve();
export function validateInvoiceXML(xml) {
  // Bound concurrent Java validators to avoid exhausting a small deployment.
  const task = validationQueue.then(async () => {
    try {
      const document = parseXML(xml);
      assert(document.Invoice, "The XML must contain an Invoice document.");
      await xsdValidator.validateXML(
        xml,
        fileURLToPath(
          new URL(
            "../../schemas/ubl/xsd/maindoc/UBL-Invoice-2.1.xsd",
            import.meta.url,
          ),
        ),
      );
      return {
        validated: true,
        message:
          "Valid UBL 2.1 invoice. This checks the XML schema; it does not certify Peppol compliance.",
      };
    } catch (error) {
      if (/java|spawn|ENOENT/i.test(error.message) && !error.messages?.length) {
        return {
          validated: false,
          message:
            "XML validation is unavailable. The server needs a Java runtime.",
          unavailable: true,
        };
      }
      return {
        validated: false,
        message: (
          error.messages?.join(" ") ||
          error.message ||
          "Invalid invoice XML."
        ).slice(0, 2000),
      };
    }
  });
  validationQueue = task.catch(() => {});
  return task;
}
