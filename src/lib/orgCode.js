// Deterministische Betriebs-ID aus dem Namen (FNV-Hash).
// Einmal vergeben = nie ändern.
export function orgCode(name) {
  const s = (name || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "") || "betrieb";
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const AB = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "", x = h;
  for (let i = 0; i < 5; i++) { code += AB[x % AB.length]; x = Math.floor(x / AB.length); }
  return code;
}
