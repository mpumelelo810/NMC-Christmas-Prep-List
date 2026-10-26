import { getStore } from "@netlify/blobs";

const STORE_NAME = "nmc-christmas-private-v1";
const KEY = "register";
const SEED = [
  ["Rice (10 kg)", "For the shared Christmas meal"], ["Chicken", "Fresh or frozen contribution"],
  ["Cooking oil", "Large bottle or 2 L"], ["Soft drinks", "Assorted drinks"], ["Bottled water", "Cases of drinking water"],
  ["Vegetables", "Fresh seasonal vegetables"], ["Bread rolls", "For serving with the meal"],
  ["Paper plates and cups", "Disposable serving supplies"], ["Napkins", "Table and serving napkins"],
  ["Cleaning supplies", "Soap, bin bags and disinfectant"], ["Christmas decorations", "Festive decorations for the venue"],
  ["Dessert or cake", "Something sweet to share"]
];
const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
async function hmac(value) {
  const key = await crypto.subtle.importKey("raw", enc.encode(process.env.NMC_SESSION_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}
async function encrypt(value) {
  const material = await crypto.subtle.digest("SHA-256", enc.encode(process.env.NMC_ENCRYPTION_SECRET || ""));
  const key = await crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return JSON.stringify({ v: 1, iv: b64(iv), data: b64(ciphertext) });
}
async function decrypt(raw) {
  if (!raw) return { items: SEED.map((x, i) => ({ id: i + 1, name: x[0], desc: x[1], status: "available", claimant: "", note: "" })) };
  const box = JSON.parse(raw);
  const material = await crypto.subtle.digest("SHA-256", enc.encode(process.env.NMC_ENCRYPTION_SECRET || ""));
  const key = await crypto.subtle.importKey("raw", material, "AES-GCM", false, ["decrypt"]);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, key, unb64(box.data));
  return JSON.parse(new TextDecoder().decode(clear));
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
    const valid = await crypto.subtle.verify("HMAC", await crypto.subtle.importKey("raw", enc.encode(process.env.NMC_SESSION_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]), unb64(signature), enc.encode(payload));
    const data = JSON.parse(new TextDecoder().decode(unb64(payload)));
    return valid && data.exp > Date.now();
  } catch { return false; }
}
function configured() {
  return Boolean(process.env.NMC_ADMIN_PASSWORD && process.env.NMC_SESSION_SECRET && process.env.NMC_ENCRYPTION_SECRET &&
    process.env.NMC_SESSION_SECRET.length >= 32 && process.env.NMC_ENCRYPTION_SECRET.length >= 32);
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
  if (!configured()) return response({ error: "Server setup incomplete. Ask the site administrator to configure the required Netlify environment variables." }, 503);
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
      if (body.password !== process.env.NMC_ADMIN_PASSWORD) return response({ error: "Incorrect password." }, 401);
      const payload = b64(enc.encode(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })));
      const signature = await hmac(payload);
      return response({ ok: true }, 200, { "set-cookie": `nmc_admin=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/.netlify/functions/api; Max-Age=28800` });
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
        data.items = SEED.map((x, i) => ({ id: i + 1, name: x[0], desc: x[1], status: "available", claimant: "", note: "" }));
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
