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
  fileInput.value = '';
  originalImage.src = '';
  svgContainer.innerHTML = '';
  controls.style.display = 'none';
  previewSection.style.display = 'none';
  dropZone.style.display = '';
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file.');
    return;
  }
  currentFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    originalImage.src = e.target.result;
    dropZone.style.display = 'none';
    controls.style.display = 'flex';
    previewSection.style.display = 'block';
    convertToSvg();
  };
  reader.readAsDataURL(file);
}

function convertToSvg() {
  if (!currentFile) return;

  svgContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Converting...</div>';

  const img = new Image();
  const url = URL.createObjectURL(currentFile);
  img.onload = () => {
    URL.revokeObjectURL(url);

    const canvas = document.createElement('canvas');
    const maxDim = 1024;
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    const options = {
      numberofcolors: parseInt(colorsSlider.value),
      pathomit: parseInt(simplifySlider.value),
      ltres: 1,
      qtres: 1,
      scale: 1,
      rightangleenhance: true,
    };

    ImageTracer.imageToSVG(
      imageData,
      (svgstr) => {
        currentSvg = svgstr;
        svgContainer.innerHTML = svgstr;

        const svgEl = svgContainer.querySelector('svg');
        if (svgEl) {
          svgEl.style.width = '100%';
          svgEl.style.height = '100%';
        }
      },
      options
    );
  };
  img.onerror = () => {
    svgContainer.innerHTML = '<p style="color:#ef4444">Error loading image.</p>';
  };
  img.src = url;
}
