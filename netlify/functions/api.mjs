import { getStore } from "@netlify/blobs";

const STORE_NAME = "nmc-christmas-private-v1";
const KEY = "register";
const LEGACY_SEED = [
  ["Rice (10 kg)", "For the shared Christmas meal"], ["Chicken", "Fresh or frozen contribution"],
  ["Cooking oil", "Large bottle or 2 L"], ["Soft drinks", "Assorted drinks"], ["Bottled water", "Cases of drinking water"],
  ["Vegetables", "Fresh seasonal vegetables"], ["Bread rolls", "For serving with the meal"],
  ["Paper plates and cups", "Disposable serving supplies"], ["Napkins", "Table and serving napkins"],
  ["Cleaning supplies", "Soap, bin bags and disinfectant"], ["Christmas decorations", "Festive decorations for the venue"],
  ["Dessert or cake", "Something sweet to share"]
];
// Actual congregation register. Contributor names and confirmation notes stay admin-only.
const SEED = [
  ["10 kg — Rice (Thai rice)", "", "taken", "Sis Thabile", "Confirm item wording"],
  ["10 kg — Rice (Thai/sihlobo rice)", "", "taken", "Make Mamba", "Confirm item and name"],
  ["5 kg — Samp", "", "taken", "MJ", "Confirm initials"],
  ["2 L — Cooking oil", "", "taken", "Make Ncongwane", "Confirm name"],
  ["2 L — Cooking oil", "", "available", "", ""],
  ["5 kg — Onions", "", "available", "", ""],
  ["10 kg — Potatoes", "", "taken", "Sis Thabile", ""],
  ["5 kg — Carrots", "", "taken", "Palesa", "Confirm name and quantity"],
  ["750 g — Mayonnaise", "", "taken", "Make Manzini", ""],
  ["750 g — Mayonnaise", "", "taken", "Nkhosingiphile Manzini", "Confirm name"],
  ["750 g — Mayonnaise", "", "available", "", ""],
  ["750 g — Mayonnaise", "", "available", "", ""],
  ["1 kg — Garlic", "", "available", "", "Confirm item"],
  ["5 L — Squash / Oros", "", "taken", "Sis Zodwa", "Confirm item and quantity"],
  ["5 kg — Butternut", "", "available", "", ""],
  ["5 kg — Green pepper", "", "available", "", ""],
  ["2 kg — Drumsticks", "", "taken", "Babe Dlamini", ""],
  ["2 kg — Drumsticks", "", "taken", "Sakhe", ""],
  ["2 kg — Drumsticks", "", "taken", "Sivikelwe", ""],
  ["5 kg — Beef", "", "taken", "Make Mwelase", "Confirm name"],
  ["5 kg — Beef", "", "taken", "Asandzesive Mwelase", "Confirm name"],
  ["5 kg — Hake", "", "taken", "Sis Pearl", "Confirm item"],
  ["5 kg — Hake", "", "taken", "Sis Pearl", "Confirm item"],
  ["5 kg — Pork", "", "available", "", ""],
  ["5 kg — Pork", "", "available", "", ""],
  ["5 kg — Beetroot", "", "taken", "Sis Thabile", ""],
  ["6 × 1 L — Milk", "", "taken", "Nondedo", "Confirm spelling"],
  ["500 g — Custard", "", "available", "", ""],
  ["500 g — Custard", "", "available", "", ""]
];
function seededItems() {
  return SEED.map((x, i) => ({ id: i + 1, name: x[0], desc: x[1], status: x[2], claimant: x[3], note: x[4] }));
}
const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
async function hmac(value) {
  const key = await crypto.subtle.importKey("raw", enc.encode(process.env.NMC_ADMIN_PASSWORD || "12345"), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}
async function encrypt(value) {
  // This register contains ordinary contribution choices, not sensitive records.
  return JSON.stringify(value);
}
async function decrypt(raw) {
  if (!raw) return { items: seededItems() };
  const data = JSON.parse(raw);
  // Safely migrate the old sample register once, while preserving any non-sample register.
  if (Array.isArray(data.items) && data.items.length === LEGACY_SEED.length &&
      data.items.every((item, i) => item.name === LEGACY_SEED[i][0])) {
    return { ...data, items: seededItems() };
  }
  return data;
}
function response(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra } });
}
function cookieValue(req) {
  return (req.headers.get("cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith("nmc_admin="))?.slice(10) || "";
}
async function isAdmin(req) {
  const token = cookieValue(req);
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  try {
    const expected = await hmac(payload);
    if (signature.length !== expected.length) return false;
    const valid = await crypto.subtle.verify("HMAC", await crypto.subtle.importKey("raw", enc.encode(process.env.NMC_ADMIN_PASSWORD || "12345"), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]), unb64(signature), enc.encode(payload));
    const data = JSON.parse(new TextDecoder().decode(unb64(payload)));
    return valid && data.exp > Date.now();
  } catch { return false; }
}
function configured() { return true; }
const PASSWORD_KEY = "admin-password";
async function passwordDigest(password, salt) {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unb64(salt), iterations: 210000, hash: "SHA-256" }, material, 256);
  return b64(bits);
}
async function verifyPassword(password) {
  const store = getStore(STORE_NAME);
  const saved = await store.get(PASSWORD_KEY);
  if (!saved) return password === (process.env.NMC_ADMIN_PASSWORD || "12345");
  try {
    const record = JSON.parse(saved);
    const candidate = await passwordDigest(password, record.salt);
    return candidate === record.hash;
  } catch { return false; }
}
async function changePassword(password) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await passwordDigest(password, salt);
  const store = getStore(STORE_NAME);
  await store.set(PASSWORD_KEY, JSON.stringify({ v: 1, salt, hash }));
}
async function loadRegister() {
  const store = getStore(STORE_NAME);
  const raw = await store.get(KEY);
  return { store, data: await decrypt(raw) };
}
async function saveRegister(store, data) {
  await store.set(KEY, await encrypt(data));
}
function publicItems(items) {
  return items.map(({ id, name, desc, status }) => ({ id, name, desc, status }));
}
export default async (req) => {
  const origin = req.headers.get("origin");
  const allowed = process.env.URL ? new URL(process.env.URL).origin : "";
  if (origin && allowed && origin !== allowed) return response({ error: "Origin not allowed." }, 403);
  if (!configured()) return response({ error: "Server setup incomplete." }, 503);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  try {
    if (req.method === "GET" && action === "list") {
      const { data } = await loadRegister();
      return response({ items: publicItems(data.items) });
    }
    if (req.method === "POST" && action === "login") {
      const body = await req.json();
      if (typeof body.password !== "string" || body.password.length > 200) return response({ error: "Invalid login." }, 400);
      if (!(await verifyPassword(body.password))) return response({ error: "Incorrect password." }, 401);
      const payload = b64(enc.encode(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })));
      const signature = await hmac(payload);
      return response({ ok: true }, 200, { "set-cookie": `nmc_admin=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/.netlify/functions/api; Max-Age=28800` });
    }
    if (req.method === "POST" && action === "change-password") {
      if (!await isAdmin(req)) return response({ error: "Admin authentication required." }, 401);
      const body = await req.json();
      if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") return response({ error: "Enter both passwords." }, 400);
      if (!(await verifyPassword(body.currentPassword))) return response({ error: "Current password is incorrect." }, 401);
      if (body.newPassword.length < 12 || body.newPassword.length > 200) return response({ error: "Choose a new password with at least 12 characters." }, 400);
      if (body.newPassword === body.currentPassword) return response({ error: "Choose a password different from the current one." }, 400);
      await changePassword(body.newPassword);
      return response({ ok: true });
    }
    if (req.method === "POST" && action === "logout") {
      return response({ ok: true }, 200, { "set-cookie": "nmc_admin=; HttpOnly; Secure; SameSite=Strict; Path=/.netlify/functions/api; Max-Age=0" });
    }
    if (req.method === "POST" && action === "claim") {
      const body = await req.json();
      if (!Number.isSafeInteger(body.id) || typeof body.name !== "string" || body.name.trim().length < 1 || body.name.length > 80 || typeof (body.note || "") !== "string" || (body.note || "").length > 180) return response({ error: "Check the name and note fields." }, 400);
      const { store, data } = await loadRegister();
      const item = data.items.find(x => x.id === body.id);
      if (!item) return response({ error: "Item not found." }, 404);
      if (item.status !== "available") return response({ error: "This item is no longer available." }, 409);
      item.status = "taken"; item.claimant = body.name.trim(); item.note = (body.note || "").trim();
      await saveRegister(store, data);
      return response({ ok: true });
    }
    if (!await isAdmin(req)) return response({ error: "Admin authentication required." }, 401);
    if (req.method === "GET" && action === "admin") {
      const { data } = await loadRegister();
      return response({ items: data.items });
    }
    if (req.method === "POST" && action === "mutate") {
      const body = await req.json();
      const { store, data } = await loadRegister();
      if (body.operation === "add") {
        const name = String(body.name || "").trim(), desc = String(body.desc || "").trim();
        if (!name || name.length > 120 || desc.length > 240) return response({ error: "Check item name and description." }, 400);
        data.items.push({ id: crypto.getRandomValues(new Uint32Array(1))[0] + Date.now(), name, desc, status: "available", claimant: "", note: "" });
      } else if (body.operation === "remove") {
        data.items = data.items.filter(x => x.id !== body.id);
      } else if (body.operation === "cancel") {
        const item = data.items.find(x => x.id === body.id);
        if (!item) return response({ error: "Item not found." }, 404);
        item.status = "available"; item.claimant = ""; item.note = "";
      } else if (body.operation === "reset") {
        data.items = seededItems();
      } else return response({ error: "Unknown operation." }, 400);
      await saveRegister(store, data);
      return response({ ok: true, items: data.items });
    }
    return response({ error: "Not found." }, 404);
  } catch (error) {
    console.error("NMC API error", error);
    return response({ error: "The request could not be completed. No private data was returned." }, 500);
  }
};
