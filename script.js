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

function convertToSvg() {
  if (!currentFile) return;
  svgContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Converting...</div>';

  var img = new Image();
  img.onload = function() {
    try {
      var numColors = parseInt(colorsSlider.value);
      var simplify = parseInt(simplifySlider.value);
      var svg = buildSvg(img, numColors, simplify);
      currentSvg = svg;
      svgContainer.innerHTML = svg;

      var svgEl = svgContainer.querySelector('svg');
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
  };
  img.onerror = function() {
    showError('Failed to load image for conversion.');
  };
  img.src = originalDataUrl;
}

function buildSvg(img, numColors, simplify) {
  var maxDim = 512;
  var w = img.width;
  var h = img.height;
  var scale = 1;
  if (w > maxDim || h > maxDim) {
    scale = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  var canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  var imageData = ctx.getImageData(0, 0, w, h);

  var result = quantizeAndTrace(imageData.data, w, h, numColors, simplify);
  var svgW = scale < 1 ? img.width : w;
  var svgH = scale < 1 ? img.height : h;

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '"' +
    ' width="' + svgW + '" height="' + svgH + '">' +
    result + '</svg>';
}

function quantizeAndTrace(pixels, w, h, numColors, simplify) {
  const colorKeys = [];
  const keyToIndex = {};
  const indexToColor = [];
  const indices = new Uint8Array(w * h);

  const step = Math.max(1, Math.round(256 / Math.cbrt(numColors)));
  const levels = Math.round(256 / step);

  for (let i = 0; i < w * h; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const a = pixels[i * 4 + 3];

    if (a < 128) {
      indices[i] = 255;
      continue;
    }

    const qr = Math.min(levels - 1, Math.floor(r / step));
    const qg = Math.min(levels - 1, Math.floor(g / step));
    const qb = Math.min(levels - 1, Math.floor(b / step));
    const key = qr + ',' + qg + ',' + qb;

    if (keyToIndex[key] === undefined) {
      keyToIndex[key] = indexToColor.length;
      indexToColor.push([
        Math.round(qr * step + step / 2),
        Math.round(qg * step + step / 2),
        Math.round(qb * step + step / 2)
      ]);
    }
    indices[i] = keyToIndex[key];
  }

  let colors = indexToColor;
  if (colors.length > numColors) {
    const merged = mergeSmallColors(indices, colors, w, h, numColors);
    colors = merged.colors;
    for (let i = 0; i < indices.length; i++) {
      indices[i] = merged.remap[indices[i]];
    }
  }

  let svgContent = '';
  for (let ci = 0; ci < colors.length; ci++) {
    if (ci === 255) continue;
    const binary = makeBinary(indices, w, h, ci);
    const pathData = traceAndSimplify(binary, w, h, simplify);
    if (pathData) {
      const hex = rgbToHex(colors[ci][0], colors[ci][1], colors[ci][2]);
      svgContent += '<path d="' + pathData + '" fill="' + hex + '" fill-rule="evenodd"/>';
    }
  }
  return svgContent;
}

function mergeSmallColors(indices, colors, w, h, targetCount) {
  const freq = new Array(colors.length).fill(0);
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] < 255) freq[indices[i]]++;
  }

  const sorted = colors.map((c, i) => i).sort((a, b) => freq[b] - freq[a]);
  const keep = new Set(sorted.slice(0, targetCount));

  const newColors = [];
  const remap = new Array(colors.length).fill(0);
  for (let i = 0; i < colors.length; i++) {
    if (keep.has(i)) {
      remap[i] = newColors.length;
      newColors.push(colors[i]);
    }
  }

  for (let i = 0; i < colors.length; i++) {
    if (!keep.has(i)) {
      let nearest = sorted[0];
      let minDist = Infinity;
      for (let j = 0; j < sorted.length; j++) {
        if (!keep.has(sorted[j])) continue;
        const d = colorDist(colors[i], colors[sorted[j]]);
        if (d < minDist) {
          minDist = d;
          nearest = sorted[j];
        }
      }
      remap[i] = remap[nearest];
    }
  }

  return { colors: newColors, remap: remap };
}

function colorDist(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function makeBinary(indices, w, h, ci) {
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    bin[i] = indices[i] === ci ? 1 : 0;
  }
  return bin;
}

function traceAndSimplify(binary, w, h, simplify) {
  const visited = new Uint8Array(w * h);
  let allPaths = '';

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (binary[y * w + x] === 1 && visited[y * w + x] === 0) {
        const boundary = traceRegion(binary, w, h, x, y, visited);
        if (boundary.length >= 3) {
          const simplified = douglasPeucker(boundary, simplify / 5 + 1);
          if (simplified.length >= 3) {
            allPaths += pointsToPath(simplified) + ' ';
          }
        }
      }
    }
  }
  return allPaths.trim();
}

function traceRegion(binary, w, h, sx, sy, visited) {
  const boundary = [];
  const queue = [[sx, sy]];
  visited[sy * w + sx] = 1;

  while (queue.length > 0) {
    const [x, y] = queue.shift();

    let isEdge = false;
    for (let dy = -1; dy <= 1 && !isEdge; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h || binary[ny * w + nx] === 0) {
          isEdge = true;
          break;
        }
      }
    }
    if (isEdge) boundary.push([x, y]);

    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && binary[ny * w + nx] === 1 && visited[ny * w + nx] === 0) {
        visited[ny * w + nx] = 1;
        queue.push([nx, ny]);
      }
    }
  }

  if (boundary.length < 3) return boundary;

  let cx = 0, cy = 0;
  for (const [x, y] of boundary) { cx += x; cy += y; }
  cx /= boundary.length;
  cy /= boundary.length;

  boundary.sort((a, b) => {
    const aa = Math.atan2(a[1] - cy, a[0] - cx);
    const ab = Math.atan2(b[1] - cy, b[0] - cx);
    return aa - ab;
  });

  return boundary;
}

function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], first, last);
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

function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

function pointsToPath(points) {
  let d = 'M ' + points[0][0] + ' ' + points[0][1];
  for (let i = 1; i < points.length; i++) {
    d += ' L ' + points[i][0] + ' ' + points[i][1];
  }
  d += ' Z';
  return d;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(function(c) { return c.toString(16).padStart(2, '0'); }).join('');
}
