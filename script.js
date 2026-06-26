const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const controls = document.getElementById('controls');
const previewSection = document.getElementById('previewSection');
const convertBtn = document.getElementById('convertBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const originalImage = document.getElementById('originalImage');
const svgContainer = document.getElementById('svgContainer');
const colorsSlider = document.getElementById('colors');
const simplifySlider = document.getElementById('simplify');
const colorsValue = document.getElementById('colorsValue');
const simplifyValue = document.getElementById('simplifyValue');

let currentFile = null;
let currentSvg = null;
let originalDataUrl = null;

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) handleFile(file);
});

colorsSlider.addEventListener('input', () => {
  colorsValue.textContent = colorsSlider.value;
});

simplifySlider.addEventListener('input', () => {
  simplifyValue.textContent = simplifySlider.value;
});

convertBtn.addEventListener('click', () => convertToSvg());

downloadBtn.addEventListener('click', () => {
  if (!currentSvg) return;
  const blob = new Blob([currentSvg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'starvector-output.svg';
  a.click();
  URL.revokeObjectURL(url);
});

resetBtn.addEventListener('click', () => {
  currentFile = null;
  currentSvg = null;
  originalDataUrl = null;
  fileInput.value = '';
  originalImage.src = '';
  svgContainer.innerHTML = '';
  controls.style.display = 'none';
  previewSection.style.display = 'none';
  dropZone.style.display = '';
});

function handleFile(file) {
  if (!file.type.startsWith('image/') && !file.name.match(/\.(png|jpg|jpeg|webp|gif|bmp)$/i)) {
    alert('Please select an image file (PNG, JPG, WebP, etc.)');
    return;
  }
  currentFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    originalDataUrl = e.target.result;
    originalImage.src = originalDataUrl;
    dropZone.style.display = 'none';
    controls.style.display = 'flex';
    previewSection.style.display = 'block';
    convertToSvg();
  };
  reader.onerror = () => {
    showError('Failed to read the image file.');
  };
  reader.readAsDataURL(file);
}

function showError(msg) {
  svgContainer.innerHTML = '<p style="color:#ef4444;padding:20px;text-align:center">' + msg + '</p>';
}

async function convertToSvg() {
  if (!currentFile) return;

  svgContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Converting...</div>';

  try {
    const numColors = parseInt(colorsSlider.value);
    const simplify = parseInt(simplifySlider.value);
    const svg = await traceImage(originalDataUrl, numColors, simplify);
    currentSvg = svg;
    svgContainer.innerHTML = svg;

    const svgEl = svgContainer.querySelector('svg');
    if (svgEl) {
      svgEl.setAttribute('width', '100%');
      svgEl.setAttribute('height', '100%');
      svgEl.style.width = '100%';
      svgEl.style.height = '100%';
    }
  } catch (err) {
    console.error(err);
    showError('Conversion failed: ' + err.message);
  }
}

function traceImage(dataUrl, numColors, simplify) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const result = doTrace(img, numColors, simplify);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

function doTrace(img, numColors, simplify) {
  const maxDim = 512;
  let w = img.width;
  let h = img.height;
  if (w > maxDim || h > maxDim) {
    const ratio = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  const quantized = quantizeColors(pixels, w, h, numColors);

  const paths = [];
  for (let ci = 0; ci < quantized.colors.length; ci++) {
    const color = quantized.colors[ci];
    const binary = makeBinaryLayer(quantized.indices, w, h, ci);
    const svgPath = traceLayer(binary, w, h, simplify);
    if (svgPath) {
      const hex = rgbToHex(color[0], color[1], color[2]);
      paths.push('<path d="' + svgPath + '" fill="' + hex + '" fill-rule="evenodd"/>');
    }
  }

  const scale = Math.max(img.width, img.height) <= maxDim ? 1 : Math.max(img.width, img.height) / maxDim;
  const svgW = scale > 1 ? Math.round(w * scale) : w;
  const svgH = scale > 1 ? Math.round(h * scale) : h;

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + svgW + '" height="' + svgH + '">' +
    paths.join('') + '</svg>';
}

function quantizeColors(pixels, w, h, numColors) {
  const colorMap = new Map();
  const indices = new Uint8Array(w * h);

  const step = Math.max(1, Math.round(256 / Math.cbrt(numColors)));
  const levels = Math.round(256 / step);

  for (let i = 0; i < w * h; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const a = pixels[i * 4 + 3];

    if (a < 128) {
      const key = 'transparent';
      if (!colorMap.has(key)) colorMap.set(key, [0, 0, 0, 0]);
      const idx = getIndex(colorMap, key);
      indices[i] = idx;
      continue;
    }

    const qr = Math.min(levels - 1, Math.floor(r / step));
    const qg = Math.min(levels - 1, Math.floor(g / step));
    const qb = Math.min(levels - 1, Math.floor(b / step));
    const key = qr + ',' + qg + ',' + qb;

    if (!colorMap.has(key)) {
      const cr = Math.round(qr * step + step / 2);
      const cg = Math.round(qg * step + step / 2);
      const cb = Math.round(qb * step + step / 2);
      colorMap.set(key, [cr, cg, cb, 0]);
    }
    indices[i] = getIndex(colorMap, key);
  }

  if (colorMap.size > numColors) {
    return mergeColorsByFrequency(indices, colorMap, w, h, numColors);
  }

  return {
    colors: Array.from(colorMap.values()),
    indices: indices
  };
}

let colorIndexCounter = 0;
function getIndex(map, key) {
  if (!map.has('_idx_' + key)) {
    map.set('_idx_' + key, colorIndexCounter++);
  }
  return map.get('_idx_' + key);
}

function mergeColorsByFrequency(indices, colorMap, w, h, targetCount) {
  const freq = new Map();
  const colorKeys = [];
  for (const [key, color] of colorMap) {
    if (key.startsWith('_idx_')) continue;
    freq.set(key, 0);
    colorKeys.push(key);
  }
  for (let i = 0; i < indices.length; i++) {
    for (const key of colorKeys) {
      if (indices[i] === colorMap.get('_idx_' + key)) {
        freq.set(key, freq.get(key) + 1);
        break;
      }
    }
  }

  colorKeys.sort((a, b) => freq.get(b) - freq.get(a));
  const keepKeys = new Set(colorKeys.slice(0, targetCount));

  const newColorMap = new Map();
  for (const key of keepKeys) {
    newColorMap.set(key, colorMap.get(key));
  }

  const newIndices = new Uint8Array(indices.length);
  const keyToNewIdx = {};
  for (const key of keepKeys) {
    const oldIdx = colorMap.get('_idx_' + key);
    keyToNewIdx[oldIdx] = getIndex(newColorMap, key);
  }

  const closest = findClosestColorMap(keepKeys, colorMap);
  for (let i = 0; i < indices.length; i++) {
    const oldIdx = indices[i];
    if (keyToNewIdx[oldIdx] !== undefined) {
      newIndices[i] = keyToNewIdx[oldIdx];
    } else {
      const nearestKey = closest[oldIdx];
      newIndices[i] = getIndex(newColorMap, nearestKey);
    }
  }

  return {
    colors: Array.from(newColorMap.values()),
    indices: newIndices
  };
}

function findClosestColorMap(keepKeys, colorMap) {
  const keepColors = [];
  const keepOldIdx = [];
  for (const key of keepKeys) {
    keepColors.push(colorMap.get(key));
    keepOldIdx.push(colorMap.get('_idx_' + key));
  }

  const mapping = {};
  for (const [key, color] of colorMap) {
    if (key.startsWith('_idx_')) continue;
    const oldIdx = colorMap.get('_idx_' + key);
    let minDist = Infinity;
    let bestKey = keepKeys.values().next().value;
    for (let j = 0; j < keepColors.length; j++) {
      const d = colorDist(color, keepColors[j]);
      if (d < minDist) {
        minDist = d;
        bestKey = Array.from(keepKeys)[j];
      }
    }
    mapping[oldIdx] = bestKey;
  }
  return mapping;
}

function colorDist(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function makeBinaryLayer(indices, w, h, colorIdx) {
  const binary = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    binary[i] = indices[i] === colorIdx ? 1 : 0;
  }
  return binary;
}

function traceLayer(binary, w, h, simplify) {
  const visited = new Uint8Array(w * h);
  let allPaths = '';

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (binary[y * w + x] === 1 && visited[y * w + x] === 0) {
        const boundary = traceBoundary(binary, w, h, x, y, visited);
        if (boundary.length > 2) {
          const simplified = douglasPeucker(boundary, simplify / 10 + 0.5);
          allPaths += pointsToSvgPath(simplified) + ' ';
        }
      }
    }
  }
  return allPaths.trim();
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];

function traceBoundary(binary, w, h, startX, startY, visited) {
  const points = [];
  const queue = [[startX, startY]];
  visited[startY * w + startX] = 1;

  while (queue.length > 0) {
    const [x, y] = queue.shift();

    const isBoundary = DIRS.some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx < 0 || nx >= w || ny < 0 || ny >= h || binary[ny * w + nx] === 0;
    });

    if (isBoundary) {
      points.push([x, y]);
    }

    for (const [dx, dy] of DIRS.slice(0, 4)) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && binary[ny * w + nx] === 1 && visited[ny * w + nx] === 0) {
        visited[ny * w + nx] = 1;
        queue.push([nx, ny]);
      }
    }
  }

  return sortBoundaryPoints(points);
}

function sortBoundaryPoints(points) {
  if (points.length < 3) return points;

  let cx = 0, cy = 0;
  for (const [x, y] of points) {
    cx += x;
    cy += y;
  }
  cx /= points.length;
  cy /= points.length;

  points.sort((a, b) => {
    const angleA = Math.atan2(a[1] - cy, a[0] - cx);
    const angleB = Math.atan2(b[1] - cy, b[0] - cx);
    return angleA - angleB;
  });

  return points;
}

function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist <= epsilon) return [first, last];

  const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
  const right = douglasPeucker(points.slice(maxIdx), epsilon);

  return left.slice(0, -1).concat(right);
}

function perpendicularDist(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
}

function pointsToSvgPath(points) {
  if (points.length === 0) return '';
  let d = 'M ' + points[0][0] + ' ' + points[0][1];
  for (let i = 1; i < points.length; i++) {
    d += ' L ' + points[i][0] + ' ' + points[i][1];
  }
  d += ' Z';
  return d;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}
