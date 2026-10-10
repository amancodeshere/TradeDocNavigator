import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, transaction } from "../connect.js";
import { assert, text, HttpError, asyncRoute } from "./errors.js";

const cookieName = "tradedocs_session";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const publicUser = (row) => ({
  userId: row.userid,
  email: row.email,
  companyName: row.companyname,
});
const newToken = () => randomBytes(32).toString("hex");
function credentials(body, registering = false) {
  const email = text(body.email, "Email", 254).toLowerCase();
  assert(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    "Enter a valid email address.",
  );
  assert(
    typeof body.password === "string" &&
      body.password.length > 0 &&
      Buffer.byteLength(body.password) <= 72,
    "Password is required and must be at most 72 bytes.",
  );
  if (registering)
    assert(
      body.password.length >= 8 &&
        /[A-Za-z]/.test(body.password) &&
        /\d/.test(body.password),
      "Password must have at least 8 characters, including a letter and a number.",
    );
  return { email, password: body.password };
}
async function addSession(client, userid, token) {
  await client.query(
    "INSERT INTO sessions (userid, valid, token_hash, expires_at) VALUES ($1, true, $2, now() + interval '7 days')",
    [userid, hashToken(token)],
  );
}
function sendSession(res, token, user) {
  res.cookie(cookieName, token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ sessionId: token, user: publicUser(user) });
}
export const register = asyncRoute(async (req, res) => {
  const { email, password } = credentials(req.body, true);
  const company = text(req.body.companyName, "Company name");
  assert(company.length >= 3, "Company name must have at least 3 characters.");
  const hashed = await bcrypt.hash(password, 12);
  const token = newToken();
  try {
    const user = await transaction(async (client) => {
      const { rows } = await client.query(
        "INSERT INTO users (email, password, companyname) VALUES ($1, $2, $3) RETURNING userid, email, companyname",
        [email, hashed, company],
      );
      await addSession(client, rows[0].userid, token);
      return rows[0];
    });
    sendSession(res, token, user);
  } catch (error) {
    if (error.code === "23505")
      throw new HttpError(
        409,
        "An account with this email already exists. Sign in instead.",
      );
    throw error;
  }
});
// A real hash ensures unknown email and incorrect password both perform bcrypt work.
const dummyHash = bcrypt.hashSync("unused-password-for-timing", 12);
export const login = asyncRoute(async (req, res) => {
  const { email, password } = credentials(req.body);
  const { rows } = await db.query(
    "SELECT userid, email, companyname, password FROM users WHERE lower(email) = $1",
    [email],
  );
  const user = rows[0];
  const match = await bcrypt.compare(password, user?.password || dummyHash);
  assert(user && match, "Email or password is incorrect.", 401);
  const token = newToken();
  await transaction(async (client) => {
    await addSession(client, user.userid, token);
    await client.query(
      "UPDATE users SET numlogins = numlogins + 1 WHERE userid = $1",
      [user.userid],
    );
  });
  sendSession(res, token, user);
});
function tokenFrom(req) {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${cookieName}=`));
  return (
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    req.headers.sessionid ||
    cookie?.slice(cookieName.length + 1)
  );
}
export const authenticate = asyncRoute(async (req, res, next) => {
  const token = tokenFrom(req);
  assert(
    typeof token === "string" && /^[a-f0-9]{64}$/.test(token),
    "Please sign in to continue.",
    401,
  );
  const { rows } = await db.query(
    `SELECT u.userid, u.email, u.companyname FROM sessions s JOIN users u ON u.userid = s.userid
    WHERE s.token_hash = $1 AND s.valid = true AND s.expires_at > now()`,
    [hashToken(token)],
  );
  assert(rows.length, "Your session has expired. Please sign in again.", 401);
  req.user = publicUser(rows[0]);
  req.tokenHash = hashToken(token);
  next();
});
export const logout = asyncRoute(async (req, res) => {
  await db.query("UPDATE sessions SET valid = false WHERE token_hash = $1", [
    req.tokenHash,
  ]);
  res.clearCookie(cookieName, cookieOptions).json({ message: "Signed out." });
});
