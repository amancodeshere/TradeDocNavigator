export interface User {
  userId: number;
  email: string;
  companyName: string;
}
export interface InvoiceItem {
  name: string;
  description: string;
  price: number;
  quantity: number;
  unit: string;
}
export interface Invoice {
  invoiceId: number;
  issueDate: string;
  partyNameBuyer: string;
  partyNameSeller: string;
  amount: number;
  currencyCode: string;
  payableAmount: string;
  salesOrderId: string;
  items?: InvoiceItem[];
}
export interface DespatchItem {
  itemId: string;
  description: string;
  quantity: number;
  unit: string;
}
export interface Despatch {
  despatchId: string;
  orderId: string;
  issueDate: string;
  supplierName: string;
  customerName: string;
  deliveryAddress: string;
  countryCode: string;
  status: string;
  items: DespatchItem[];
}
export interface ShipmentEvent {
  status?: string;
  message?: string;
  description?: string;
  datetime?: string;
  tracking_location?: { city?: string; country?: string };
}
export interface Shipment {
  shipmentId: string;
  trackingNumber: string;
  trackingProvider: string;
  status: string;
  syncedAt: string | null;
  data: {
    simulated?: boolean;
    demoStep?: number;
    events?: ShipmentEvent[];
    tracking_est_delivery_date?: string;
    destination_country?: string;
  };
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "same-origin",
      signal: AbortSignal.timeout(30000),
      ...options,
      headers: {
        ...(options.body && typeof options.body === "string"
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "Could not reach the server. Check your connection and try again.",
    );
  }
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("json") ? await response.json() : null;
  if (!response.ok) {
    if (response.status === 401 && !path.includes("/admin/login"))
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      response.status,
      data?.error || `Request failed (${response.status}). Please try again.`,
    );
  }
  if (!contentType.includes("json"))
    throw new ApiError(
      502,
      "The server returned an unexpected response. Please try again.",
    );
  return data as T;
}
export async function download(path: string, filename: string) {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "same-origin",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new ApiError(
      0,
      "Could not download the file. Check your connection and try again.",
    );
  }
  if (!response.ok || !response.headers.get("content-type")?.includes("xml")) {
    if (response.status === 401)
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      response.status,
      "Could not download XML. Please refresh the page and try again.",
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};
export const displayDate = (value: string) =>
  new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
