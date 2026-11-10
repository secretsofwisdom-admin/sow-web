// Saved birth profiles: validation and row mapping shared by
// profiles/index.js and profiles/[id].js. Leading underscore => not a route.
//
// `form` is the BaZi calculator's birth form, in the same JSON shape the app
// writes for its own session memory (BaziCalculator/lib/models/
// birth_form_codec.dart) minus `name`, which has its own column. The server
// does not interpret it beyond checking types and ranges, so a new switch in
// the app needs a key added here and nothing else.

export const MAX_PROFILES = 500;
export const MAX_NAME = 120;
export const MAX_NOTE = 2000;
const MAX_FORM_BYTES = 4096;

const GENDERS = new Set(["male", "female", "other"]);
const FLAGS = ["solar", "eot", "lateZi", "absTerm", "lunar", "hourFirst", "hourUnknown"];

function isInt(v, lo, hi) {
  return Number.isInteger(v) && v >= lo && v <= hi;
}
function isNum(v, lo, hi) {
  return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
}
function isStr(v, max) {
  return typeof v === "string" && v.length <= max;
}

// Returns { form } (a clean copy holding only known keys) or { error }.
export function validateBirthForm(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Missing birth data." };
  const f = raw;
  if (f.v !== 1) return { error: "Unsupported birth data version." };
  if (!GENDERS.has(f.gender)) return { error: "Invalid gender." };
  if (!isInt(f.year, 1900, 2100)) return { error: "Invalid year." };
  if (!isInt(f.month, 1, 12)) return { error: "Invalid month." };
  if (!isInt(f.day, 1, 31)) return { error: "Invalid day." };
  if (!isInt(f.hour, 0, 23)) return { error: "Invalid hour." };
  if (!isInt(f.minute, 0, 59)) return { error: "Invalid minute." };
  // The coordinate boxes hold whatever was typed, so these stay strings.
  if (!isStr(f.lat, 24) || !isStr(f.lon, 24) || !isStr(f.tz, 64)) return { error: "Invalid place." };

  let city = null;
  if (f.city != null) {
    const c = f.city;
    if (typeof c !== "object" || Array.isArray(c) ||
        !isStr(c.name, 120) || !c.name || !isStr(c.country, 120) ||
        !isNum(c.lat, -90, 90) || !isNum(c.lon, -180, 180) || !isStr(c.tz, 64) ||
        (c.native != null && !isStr(c.native, 120))) {
      return { error: "Invalid place." };
    }
    city = { name: c.name, country: c.country, lat: c.lat, lon: c.lon, tz: c.tz, native: c.native ?? null };
  }

  const form = {
    v: 1, gender: f.gender, day: f.day, month: f.month, year: f.year,
    hour: f.hour, minute: f.minute, city, lat: f.lat, lon: f.lon, tz: f.tz,
  };
  for (const k of FLAGS) {
    if (typeof f[k] !== "boolean") return { error: "Invalid birth data." };
    form[k] = f[k];
  }
  if (JSON.stringify(form).length > MAX_FORM_BYTES) return { error: "Birth data is too large." };
  return { form };
}

// Returns { name } or { error }.
export function cleanName(v) {
  const name = typeof v === "string" ? v.trim() : "";
  if (!name) return { error: "Please give the profile a name." };
  if (name.length > MAX_NAME) return { error: `Names are limited to ${MAX_NAME} characters.` };
  return { name };
}

// Returns { note } or { error }.
export function cleanNote(v) {
  if (v == null) return { note: "" };
  if (typeof v !== "string") return { error: "Invalid note." };
  if (v.length > MAX_NOTE) return { error: `Notes are limited to ${MAX_NOTE} characters.` };
  return { note: v };
}

export function profileJson(row) {
  let form = null;
  try { form = JSON.parse(row.form); } catch (_) { /* reported as null */ }
  return {
    id: row.id,
    name: row.name,
    isSelf: row.is_self === 1,
    note: row.note,
    form,
    folderId: row.folder_id ?? null,
    updatedAt: row.updated_at,
  };
}

export const PROFILE_COLUMNS = "id, name, is_self, form, note, folder_id, updated_at";
