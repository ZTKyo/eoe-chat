import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("/workspace/public/icons", { recursive: true });

const BRAND = "#17252a";
const WHITE = "#ffffff";

function svgForAny(size) {
  const fontSize = Math.round(size * 0.43);
  const radius = Math.round(size * 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${BRAND}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="-0.08em" fill="${WHITE}">EO</text>
</svg>`;
}

function svgForMaskable(size) {
  const fontSize = Math.round(size * 0.34);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BRAND}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="-0.08em" fill="${WHITE}">EO</text>
</svg>`;
}

const icons = [
  { name: "icon-192.png", size: 192, svg: svgForAny(192) },
  { name: "icon-512.png", size: 512, svg: svgForAny(512) },
  { name: "icon-192-maskable.png", size: 192, svg: svgForMaskable(192) },
  { name: "icon-512-maskable.png", size: 512, svg: svgForMaskable(512) },
  { name: "apple-touch-icon.png", size: 180, svg: svgForAny(180) },
];

for (const icon of icons) {
  const outPath = `/workspace/public/icons/${icon.name}`;
  await sharp(Buffer.from(icon.svg)).png().toFile(outPath);
  const meta = await sharp(outPath).metadata();
  console.log(`${icon.name}: ${meta.width}x${meta.height} (${meta.format})`);
}
console.log("All icons generated.");
