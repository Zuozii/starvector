var dropZone = document.getElementById('dropZone');
var fileInput = document.getElementById('fileInput');
var controls = document.getElementById('controls');
var previewSection = document.getElementById('previewSection');
var convertBtn = document.getElementById('convertBtn');
var downloadBtn = document.getElementById('downloadBtn');
var resetBtn = document.getElementById('resetBtn');
var originalImage = document.getElementById('originalImage');
var svgContainer = document.getElementById('svgContainer');
var colorsSlider = document.getElementById('colors');
var simplifySlider = document.getElementById('simplify');
var colorsValue = document.getElementById('colorsValue');
var simplifyValue = document.getElementById('simplifyValue');

var currentFile = null;
var currentSvg = null;
var originalDataUrl = null;

dropZone.addEventListener('click', function() { fileInput.click(); });

dropZone.addEventListener('dragover', function(e) {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', function() {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', function(e) {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  var file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', function() {
  var file = fileInput.files[0];
  if (file) handleFile(file);
});

colorsSlider.addEventListener('input', function() {
  colorsValue.textContent = colorsSlider.value;
});

simplifySlider.addEventListener('input', function() {
  simplifyValue.textContent = simplifySlider.value;
});

convertBtn.addEventListener('click', function() { doConvert(); });

downloadBtn.addEventListener('click', function() {
  if (!currentSvg) return;
  var blob = new Blob([currentSvg], { type: 'image/svg+xml' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'starvector-output.svg';
  a.click();
  URL.revokeObjectURL(url);
});

resetBtn.addEventListener('click', function() {
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
  var reader = new FileReader();
  reader.onload = function(e) {
    originalDataUrl = e.target.result;
    originalImage.src = originalDataUrl;
    dropZone.style.display = 'none';
    controls.style.display = 'flex';
    previewSection.style.display = 'block';
    doConvert();
  };
  reader.onerror = function() {
    showError('Failed to read the image file.');
  };
  reader.readAsDataURL(file);
}

function showError(msg) {
  svgContainer.innerHTML = '<p style="color:#ef4444;padding:20px;text-align:center">' + msg + '</p>';
}

function doConvert() {
  if (!originalDataUrl) return;
  svgContainer.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Converting...</div>';

  var img = new Image();
  img.onload = function() {
    try {
      var w = img.width;
      var h = img.height;
      var maxDim = 1024;

      var canvas = document.createElement('canvas');
      if (w > maxDim || h > maxDim) {
        var ratio = Math.min(maxDim / w, maxDim / h);
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
      } else {
        canvas.width = w;
        canvas.height = h;
      }

      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      var options = {
        numberofcolors: parseInt(colorsSlider.value),
        pathomit: parseInt(simplifySlider.value),
        ltres: 1,
        qtres: 1,
        scale: 1,
        rightangleenhance: true
      };

      var svgstr = ImageTracer.imagedataToSVG(imageData, options);
      currentSvg = svgstr;
      svgContainer.innerHTML = svgstr;
      var svgEl = svgContainer.querySelector('svg');
      if (svgEl) {
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
