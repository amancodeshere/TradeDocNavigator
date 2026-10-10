export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function assert(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}
export function text(value, name, max = 200) {
  assert(
    typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= max,
    `${name} is required and must be at most ${max} characters.`,
  );
  return value.trim();
}
export function date(value) {
  assert(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Enter a valid date in YYYY-MM-DD format.",
  );
  return value;
}
export function decimal(value, name, minimum = 0, places = 2) {
  assert(
    (typeof value === "number" || typeof value === "string") &&
      String(value).trim() !== "",
    `${name} is required.`,
  );
  const number = Number(value);
  assert(
    Number.isFinite(number) &&
      number >= minimum &&
      number < 1e12 &&
      Math.abs(number * 10 ** places - Math.round(number * 10 ** places)) <
        0.001,
    `${name} must be at least ${minimum} with at most ${places} decimal places.`,
  );
  return number;
}
export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
