// Erzeugt die PWA-PNG-Icons (192/512 + maskable + apple-touch) ohne externe
// Abhängigkeit: reiner RGBA-Buffer → PNG via zlib. Logo = indigo Rundquadrat
// mit zwei weißen Balken (ShiftSync-Marke).
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const ACC = [0x4f, 0x46, 0xe5]; // #4f46e5
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Zeichnet das Logo in einen RGBA-Buffer.
// maskable=true → Logo kleiner (Safe-Zone), Hintergrund füllt komplett.
function drawIcon(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const px = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  // Hintergrund: maskable = ganzflächig, sonst Rundquadrat
  const pad = maskable ? 0 : Math.round(size * 0.06);
  const inner = size - 2 * pad;
  const radius = maskable ? 0 : Math.round(inner * 0.22);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const lx = x - pad, ly = y - pad;
      if (lx < 0 || ly < 0 || lx >= inner || ly >= inner) continue;
      // abgerundete Ecken
      let inside = true;
      const corners = [[radius, radius], [inner - radius, radius], [radius, inner - radius], [inner - radius, inner - radius]];
      if (lx < radius && ly < radius) inside = (lx - radius) ** 2 + (ly - radius) ** 2 <= radius ** 2;
      else if (lx > inner - radius && ly < radius) inside = (lx - (inner - radius)) ** 2 + (ly - radius) ** 2 <= radius ** 2;
      else if (lx < radius && ly > inner - radius) inside = (lx - radius) ** 2 + (ly - (inner - radius)) ** 2 <= radius ** 2;
      else if (lx > inner - radius && ly > inner - radius) inside = (lx - (inner - radius)) ** 2 + (ly - (inner - radius)) ** 2 <= radius ** 2;
      if (inside) px(x, y, ACC);
    }
  }
  // zwei weiße Balken (Schichtbalken), zentriert; bei maskable auf Safe-Zone (~70%)
  const scale = maskable ? 0.5 : 0.62;
  const cx = size / 2, cy = size / 2;
  const barW = Math.round(size * scale);
  const barH = Math.round(size * 0.13);
  const gap = Math.round(size * 0.085);
  const x0 = Math.round(cx - barW / 2);
  const rad = Math.round(barH / 2);
  const bars = [Math.round(cy - gap / 2 - barH), Math.round(cy + gap / 2)];
  for (const by of bars) {
    for (let y = by; y < by + barH; y++) {
      for (let x = x0; x < x0 + barW; x++) {
        // runde Balkenenden
        let ok = true;
        const ly = y - by;
        if (x < x0 + rad) ok = (x - (x0 + rad)) ** 2 + (ly - rad) ** 2 <= rad ** 2 || ly >= 0 && ly < barH && x >= x0 + rad;
        if (x > x0 + barW - rad) ok = (x - (x0 + barW - rad)) ** 2 + (ly - rad) ** 2 <= rad ** 2 || ly >= 0 && ly < barH && x <= x0 + barW - rad;
        if (ok) px(x, y, WHITE);
      }
    }
  }
  return buf;
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
const targets = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
];
for (const [name, size, maskable] of targets) {
  const buf = drawIcon(size, maskable);
  fs.writeFileSync(path.join(outDir, name), encodePNG(size, size, buf));
  console.log("✓", name, `(${size}×${size})`);
}
console.log("Icons erzeugt in", outDir);
