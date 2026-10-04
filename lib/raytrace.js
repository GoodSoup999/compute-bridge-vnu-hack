// Small CPU path tracer for a reproducible distributed rendering demo.
const spheres = [
  { x: 0, y: -1001, z: -3, r: 1000, color: [0.76, 0.8, 0.9], kind: 'ground' },
  { x: -1.45, y: 0, z: -3.2, r: 1, color: [0.95, 0.2, 0.15], kind: 'diffuse' },
  { x: 1.25, y: -0.15, z: -2.7, r: 0.85, color: [0.76, 0.84, 0.94], kind: 'metal' },
  { x: 0.05, y: 0.28, z: -5.25, r: 1.25, color: [0.2, 0.5, 0.95], kind: 'diffuse' },
  { x: 0, y: 5, z: -3, r: 1.2, color: [1, 0.91, 0.75], kind: 'light' }
];
const light = spheres[4];

function renderTile({ width, height, y, rows, samples }) {
  const pixels = Buffer.alloc(width * rows * 3);
  let seed = 1;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const result = { r: 0, g: 0, b: 0 };
  const fov = Math.tan(50 * Math.PI / 360);
  const aspect = width / height;
  const fy = -1.1 / Math.hypot(1.1, 7.5);
  const fz = -7.5 / Math.hypot(1.1, 7.5);
  const uy = -fz, uz = fy;

  function nearest(ox, oy, oz, dx, dy, dz, maxT = Infinity, ignoreLight = false) {
    let best = -1, distance = maxT;
    for (let i = 0; i < spheres.length; i++) {
      if (ignoreLight && i === 4) continue;
      const s = spheres[i];
      const qx = ox - s.x, qy = oy - s.y, qz = oz - s.z;
      const b = qx * dx + qy * dy + qz * dz;
      const c = qx * qx + qy * qy + qz * qz - s.r * s.r;
      const disc = b * b - c;
      if (disc < 0) continue;
      let t = -b - Math.sqrt(disc);
      if (t < 0.001) t = -b + Math.sqrt(disc);
      if (t > 0.001 && t < distance) { best = i; distance = t; }
    }
    return { best, distance };
  }

  function trace(dx, dy, dz) {
    let ox = 0, oy = 1.1, oz = 4.5;
    let throughputR = 1, throughputG = 1, throughputB = 1;
    result.r = result.g = result.b = 0;
    for (let bounce = 0; bounce < 4; bounce++) {
      const hit = nearest(ox, oy, oz, dx, dy, dz);
      if (hit.best < 0) {
        const t = Math.max(0, Math.min(1, (dy + 1) * 0.5));
        result.r += throughputR * (0.5 + 0.45 * t);
        result.g += throughputG * (0.62 + 0.32 * t);
        result.b += throughputB * (0.83 + 0.15 * t);
        break;
      }
      const s = spheres[hit.best];
      if (s.kind === 'light') {
        result.r += throughputR * 5;
        result.g += throughputG * 4.55;
        result.b += throughputB * 3.75;
        break;
      }
      const px = ox + dx * hit.distance, py = oy + dy * hit.distance, pz = oz + dz * hit.distance;
      const nx = (px - s.x) / s.r, ny = (py - s.y) / s.r, nz = (pz - s.z) / s.r;
      let cr = s.color[0], cg = s.color[1], cb = s.color[2];
      if (s.kind === 'ground' && ((Math.floor(px) + Math.floor(pz)) & 1)) {
        cr *= 0.28; cg *= 0.28; cb *= 0.28;
      }

      // One random point on the area light gives a soft shadow after averaging samples.
      const lx = light.x + (random() - 0.5) * 1.6 - px;
      const ly = light.y + (random() - 0.5) * 0.8 - py;
      const lz = light.z + (random() - 0.5) * 1.6 - pz;
      const lightDistance = Math.hypot(lx, ly, lz);
      const ldx = lx / lightDistance, ldy = ly / lightDistance, ldz = lz / lightDistance;
      const facing = Math.max(0, nx * ldx + ny * ldy + nz * ldz);
      if (facing > 0 && nearest(px + nx * 0.002, py + ny * 0.002, pz + nz * 0.002,
        ldx, ldy, ldz, lightDistance - 0.02, true).best < 0) {
        const lightPower = 3.6 * facing / (1 + lightDistance * lightDistance * 0.055);
        result.r += throughputR * cr * lightPower;
        result.g += throughputG * cg * lightPower * 0.91;
        result.b += throughputB * cb * lightPower * 0.75;
      }

      if (s.kind === 'metal') {
        const dot = dx * nx + dy * ny + dz * nz;
        dx -= 2 * dot * nx;
        dy -= 2 * dot * ny;
        dz -= 2 * dot * nz;
        dx += (random() - 0.5) * 0.09;
        dy += (random() - 0.5) * 0.09;
        dz += (random() - 0.5) * 0.09;
      } else {
        const angle = random() * 2 * Math.PI;
        const z = random() * 2 - 1;
        const radius = Math.sqrt(1 - z * z);
        dx = nx + radius * Math.cos(angle);
        dy = ny + radius * Math.sin(angle);
        dz = nz + z;
      }
      const length = Math.hypot(dx, dy, dz);
      dx /= length; dy /= length; dz /= length;
      ox = px + nx * 0.002; oy = py + ny * 0.002; oz = pz + nz * 0.002;
      throughputR *= cr * 0.7;
      throughputG *= cg * 0.7;
      throughputB *= cb * 0.7;
    }
  }

  function byte(value) {
    const mapped = value / (1 + value);
    return Math.max(0, Math.min(255, Math.round(Math.sqrt(mapped) * 255)));
  }
  for (let row = 0; row < rows; row++) {
    const globalY = y + row;
    for (let x = 0; x < width; x++) {
      seed = (Math.imul(x + 1, 73856093) ^ Math.imul(globalY + 1, 19349663)) >>> 0;
      let r = 0, g = 0, b = 0;
      for (let sample = 0; sample < samples; sample++) {
        const u = ((x + random()) / width - 0.5) * 2 * aspect * fov;
        const v = (0.5 - (globalY + random()) / height) * 2 * fov;
        let dx = u, dy = fy + v * uy, dz = fz + v * uz;
        const length = Math.hypot(dx, dy, dz);
        trace(dx / length, dy / length, dz / length);
        r += result.r; g += result.g; b += result.b;
      }
      const i = (row * width + x) * 3;
      pixels[i] = byte(r / samples);
      pixels[i + 1] = byte(g / samples);
      pixels[i + 2] = byte(b / samples);
    }
  }
  return pixels;
}

module.exports = { renderTile };
