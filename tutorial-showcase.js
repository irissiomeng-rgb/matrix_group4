(() => {
  "use strict";

  const CHANNELS = 4;
  const FFT_WORK_WIDTH = 256;
  const FFT_WORK_HEIGHT = 128;
  const PCA_LONG_EDGE = 64;
  const PCA_MIN_SHORT_EDGE = 32;
  const PCA_EIGEN_EPSILON = 1e-6;
  const SHOWCASE_FUJI_IMAGE_URL = "./Fuji.png";
  const SHOWCASE_CITY_IMAGE_URL = "./CITY.png";
  const SHOWCASE_ROAD_IMAGE_URL = "./road-lines.png";
  const SHOWCASE_MAX_LONG_EDGE = 1440;
  const FALLBACK_WIDTH = 1536;
  const FALLBACK_HEIGHT = 1024;

  // ================================================================
  // MathJax 載入保證：同時處理 MathJax 已就緒、頁面仍在載入、頁面已載入完成三種情境
  // ================================================================
  function ensureMathJaxReady(callback) {
    if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
      window.MathJax.startup.promise.then(function() {
        setTimeout(function() {
          if (window.MathJax && window.MathJax.typesetPromise) {
            callback();
          }
        }, 500);
      }).catch(function(err) {
        console.log('MathJax startup promise error:', err);
        setTimeout(function() {
          if (window.MathJax && window.MathJax.typesetPromise) {
            callback();
          }
        }, 500);
      });
    } else if (document.readyState === "complete") {
      // 頁面已載入完成，但 MathJax 尚未就緒（腳本晚於 load 事件後注入），輪詢偵測
      let attempts = 0;
      var pollTimer = setInterval(function() {
        attempts++;
        if (window.MathJax && window.MathJax.typesetPromise) {
          clearInterval(pollTimer);
          setTimeout(function() { callback(); }, 500);
        } else if (attempts >= 20) {
          clearInterval(pollTimer);
        }
      }, 250);
    } else {
      window.addEventListener("load", function() {
        setTimeout(function() {
          if (window.MathJax && window.MathJax.typesetPromise) {
            callback();
          }
        }, 500);
      });
    }
  }

  // ================================================================
  // Inline Worker 工廠：用於 FFT / Canny 背景運算，支援 file:/// 協議
  // ================================================================
  function createInlineWorker(workerSource) {
    const blob = new Blob([workerSource], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const worker = new Worker(blobUrl);
    let aborted = false;
    return {
      worker,
      aborted: () => aborted,
      terminate() {
        aborted = true;
        worker.terminate();
        URL.revokeObjectURL(blobUrl);
      }
    };
  }

  // FFT Worker 原始碼：正向 FFT → 遮罩/頻譜 → 反向 FFT 一條龍
  const SHOWCASE_FFT_WORKER_SOURCE = `
    "use strict";

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function fft1dInPlace(re, im, inverse = false) {
      const n = re.length;
      let j = 0;
      for (let i = 1; i < n; i += 1) {
        let bit = n >> 1;
        while (j & bit) {
          j ^= bit;
          bit >>= 1;
        }
        j ^= bit;
        if (i < j) {
          [re[i], re[j]] = [re[j], re[i]];
          [im[i], im[j]] = [im[j], im[i]];
        }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const angle = (inverse ? 2 : -2) * Math.PI / len;
        const wLenCos = Math.cos(angle);
        const wLenSin = Math.sin(angle);
        for (let i = 0; i < n; i += len) {
          let wCos = 1;
          let wSin = 0;
          const half = len >> 1;
          for (let k = 0; k < half; k += 1) {
            const evenIndex = i + k;
            const oddIndex = evenIndex + half;
            const oddRe = re[oddIndex] * wCos - im[oddIndex] * wSin;
            const oddIm = re[oddIndex] * wSin + im[oddIndex] * wCos;
            const evenRe = re[evenIndex];
            const evenIm = im[evenIndex];
            re[evenIndex] = evenRe + oddRe;
            im[evenIndex] = evenIm + oddIm;
            re[oddIndex] = evenRe - oddRe;
            im[oddIndex] = evenIm - oddIm;
            const nextCos = wCos * wLenCos - wSin * wLenSin;
            const nextSin = wCos * wLenSin + wSin * wLenCos;
            wCos = nextCos;
            wSin = nextSin;
          }
        }
      }
      if (inverse) {
        for (let i = 0; i < n; i += 1) {
          re[i] /= n;
          im[i] /= n;
        }
      }
    }

    function fft2dInPlace(reRows, imRows, inverse = false) {
      const height = reRows.length;
      const width = reRows[0].length;
      for (let y = 0; y < height; y += 1) {
        fft1dInPlace(reRows[y], imRows[y], inverse);
      }
      const colRe = new Float64Array(height);
      const colIm = new Float64Array(height);
      for (let x = 0; x < width; x += 1) {
        for (let y = 0; y < height; y += 1) {
          colRe[y] = reRows[y][x];
          colIm[y] = imRows[y][x];
        }
        fft1dInPlace(colRe, colIm, inverse);
        for (let y = 0; y < height; y += 1) {
          reRows[y][x] = colRe[y];
          imRows[y][x] = colIm[y];
        }
      }
    }

    function buildSpectrumLogData(reRows, imRows) {
      const height = reRows.length;
      const width = reRows[0].length;
      const logMagnitude = new Float64Array(width * height);
      let minLog = Infinity;
      let maxLog = 0;
      for (let sy = 0; sy < height; sy += 1) {
        const sourceY = (sy + height / 2) % height;
        const rowOffset = sy * width;
        for (let sx = 0; sx < width; sx += 1) {
          const sourceX = (sx + width / 2) % width;
          const value = Math.log1p(Math.hypot(reRows[sourceY][sourceX], imRows[sourceY][sourceX]));
          logMagnitude[rowOffset + sx] = value;
          if (value < minLog) minLog = value;
          if (value > maxLog) maxLog = value;
        }
      }
      return { width, height, logMagnitude, minLog: Number.isFinite(minLog) ? minLog : 0, maxLog };
    }

    function buildSpectrumImageData(spectrumData, strengthValue) {
      const { width, height, logMagnitude, maxLog } = spectrumData;
      const normalizedStrength = clamp(strengthValue / 100, 0, 1);
      const output = new Float64Array(logMagnitude.length);
      if (maxLog < 1e-8) { output.fill(0); return Array.from(output); }
      const displayFloor = maxLog * (0.16 - normalizedStrength * 0.12);
      const displaySpan = Math.max(1e-8, maxLog - displayFloor);
      const gamma = 1.25 - normalizedStrength * 0.7;
      const contrast = 0.92 + normalizedStrength * 1.5;
      for (let i = 0; i < logMagnitude.length; i += 1) {
        let value = clamp((logMagnitude[i] - displayFloor) / displaySpan, 0, 1);
        value = Math.pow(value, gamma);
        value = clamp((value - 0.5) * contrast + 0.5, 0, 1);
        output[i] = value * 255;
      }
      return Array.from(output);
    }

    function applyFrequencyMask(reRows, imRows, mode, strengthValue) {
      const height = reRows.length;
      const width = reRows[0].length;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.hypot(centerX, centerY);
      const normalizedStrength = clamp(strengthValue / 100, 0, 1);
      const cutoffRadius = mode === "lowpass"
        ? maxRadius * (0.82 - normalizedStrength * 0.7)
        : maxRadius * (0.08 + normalizedStrength * 0.58);
      const butterworthOrder = 2 + normalizedStrength * 4;
      for (let sy = 0; sy < height; sy += 1) {
        const sourceY = (sy + height / 2) % height;
        const dy = sy - centerY;
        for (let sx = 0; sx < width; sx += 1) {
          const sourceX = (sx + width / 2) % width;
          const dx = sx - centerX;
          const distance = Math.max(1e-6, Math.hypot(dx, dy));
          const lowpassWeight = 1 / (1 + Math.pow(distance / Math.max(1, cutoffRadius), butterworthOrder * 2));
          const weight = mode === "lowpass" ? lowpassWeight : 1 - lowpassWeight;
          reRows[sourceY][sourceX] *= weight;
          imRows[sourceY][sourceX] *= weight;
        }
      }
    }

    function processFFT(grayBuffer, width, height, mode, strengthValue) {
      const reRows = [];
      for (let y = 0; y < height; y += 1) {
        const row = new Float64Array(width);
        for (let x = 0; x < width; x += 1) {
          row[x] = grayBuffer[y * width + x];
        }
        reRows.push(row);
      }
      const imRows = [];
      for (let y = 0; y < height; y += 1) {
        imRows.push(new Float64Array(width));
      }
      fft2dInPlace(reRows, imRows, false);
      const spectrumData = buildSpectrumLogData(reRows, imRows);
      if (mode === "spectrum") {
        return { type: "spectrum", spectrumImageData: buildSpectrumImageData(spectrumData, strengthValue), width, height, spectrumData };
      }
      const filteredRe = reRows.map(row => Float64Array.from(row));
      const filteredIm = imRows.map(row => Float64Array.from(row));
      applyFrequencyMask(filteredRe, filteredIm, mode, strengthValue);
      fft2dInPlace(filteredRe, filteredIm, true);
      const spatial = new Float64Array(width * height);
      let index = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          spatial[index] = filteredRe[y][x];
          index += 1;
        }
      }
      const output = new Float64Array(spatial.length);
      if (mode === "lowpass") {
        for (let i = 0; i < spatial.length; i += 1) {
          output[i] = clamp(spatial[i], 0, 255);
        }
      } else {
        const normalizedStrength = clamp(strengthValue / 100, 0, 1);
        const boost = 0.55 + normalizedStrength * 2.45;
        for (let i = 0; i < spatial.length; i += 1) {
          output[i] = clamp(grayBuffer[i] + spatial[i] * boost, 0, 255);
        }
      }
      return { type: "filtered", outputData: Array.from(output), spectrumData, width, height };
    }

    self.onmessage = function(e) {
      const { grayBuffer, width, height, mode, strengthValue } = e.data;
      const result = processFFT(grayBuffer, width, height, mode, strengthValue);
      self.postMessage(result);
    };
  `;

  // Canny Worker 原始碼：灰階 → 高斯模糊 → 梯度 → NMS → 雙閾值追蹤
  const SHOWCASE_CANNY_WORKER_SOURCE = `
    "use strict";

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function quantizeDirection(angle) {
      const normalized = ((angle * 180) / Math.PI + 180) % 180;
      if (normalized < 22.5 || normalized >= 157.5) return 0;
      if (normalized < 67.5) return 45;
      if (normalized < 112.5) return 90;
      return 135;
    }

    function buildGaussianKernel1D(blurSigma) {
      const sigma = Math.max(0.8, blurSigma);
      const radius = Math.max(1, Math.ceil(sigma * 2));
      const kernel = new Float64Array(radius * 2 + 1);
      let sum = 0;
      for (let i = -radius; i <= radius; i += 1) {
        const value = Math.exp(-(i * i) / (2 * sigma * sigma));
        kernel[i + radius] = value;
        sum += value;
      }
      for (let i = 0; i < kernel.length; i += 1) kernel[i] /= sum;
      return { kernel, radius };
    }

    function gaussianBlurGrayBuffer(grayBuffer, width, height, blurSigma) {
      const { kernel, radius } = buildGaussianKernel1D(blurSigma);
      const temp = new Float64Array(grayBuffer.length);
      const output = new Float64Array(grayBuffer.length);
      for (let y = 0; y < height; y += 1) {
        const rowOffset = y * width;
        for (let x = 0; x < width; x += 1) {
          let sum = 0;
          for (let k = -radius; k <= radius; k += 1) {
            const px = clamp(x + k, 0, width - 1);
            sum += grayBuffer[rowOffset + px] * kernel[k + radius];
          }
          temp[rowOffset + x] = sum;
        }
      }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          let sum = 0;
          for (let k = -radius; k <= radius; k += 1) {
            const py = clamp(y + k, 0, height - 1);
            sum += temp[py * width + x] * kernel[k + radius];
          }
          output[y * width + x] = sum;
        }
      }
      return output;
    }

    function processCanny(sourceData, width, height, blurSigma, lowThreshold, highThreshold) {
      const gray = new Float64Array(width * height);
      for (let i = 0, j = 0; i < sourceData.length; i += 4, j += 1) {
        gray[j] = 0.299 * sourceData[i] + 0.587 * sourceData[i + 1] + 0.114 * sourceData[i + 2];
      }
      const blurred = gaussianBlurGrayBuffer(gray, width, height, blurSigma);
      const magnitude = new Float64Array(width * height);
      const direction = new Uint8Array(width * height);
      let maxMagnitude = 0;
      const gxKernel = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
      const gyKernel = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          let gradX = 0;
          let gradY = 0;
          for (let ky = 0; ky < 3; ky += 1) {
            for (let kx = 0; kx < 3; kx += 1) {
              const px = x + kx - 1;
              const py = y + ky - 1;
              const value = blurred[py * width + px];
              gradX += value * gxKernel[ky][kx];
              gradY += value * gyKernel[ky][kx];
            }
          }
          const mag = Math.hypot(gradX, gradY);
          const index = y * width + x;
          magnitude[index] = mag;
          direction[index] = quantizeDirection(Math.atan2(gradY, gradX));
          if (mag > maxMagnitude) maxMagnitude = mag;
        }
      }
      const normalizedMagnitude = new Float64Array(width * height);
      const scale = maxMagnitude > 0 ? 255 / maxMagnitude : 0;
      for (let i = 0; i < magnitude.length; i += 1) normalizedMagnitude[i] = magnitude[i] * scale;
      const suppressed = new Float64Array(width * height);
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const index = y * width + x;
          const value = normalizedMagnitude[index];
          let neighborA = 0, neighborB = 0;
          const dir = direction[index];
          if (dir === 0) { neighborA = normalizedMagnitude[index - 1]; neighborB = normalizedMagnitude[index + 1]; }
          else if (dir === 45) { neighborA = normalizedMagnitude[index - width + 1]; neighborB = normalizedMagnitude[index + width - 1]; }
          else if (dir === 90) { neighborA = normalizedMagnitude[index - width]; neighborB = normalizedMagnitude[index + width]; }
          else { neighborA = normalizedMagnitude[index - width - 1]; neighborB = normalizedMagnitude[index + width + 1]; }
          suppressed[index] = value >= neighborA && value >= neighborB ? value : 0;
        }
      }
      const strong = 2, weak = 1;
      const edgeKinds = new Uint8Array(width * height);
      const stack = [];
      for (let i = 0; i < suppressed.length; i += 1) {
        if (suppressed[i] >= highThreshold) { edgeKinds[i] = strong; stack.push(i); }
        else if (suppressed[i] >= lowThreshold) edgeKinds[i] = weak;
      }
      while (stack.length > 0) {
        const index = stack.pop();
        const x = index % width;
        const y = Math.floor(index / width);
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const px = x + dx, py = y + dy;
            if (px < 0 || px >= width || py < 0 || py >= height) continue;
            const neighbor = py * width + px;
            if (edgeKinds[neighbor] === weak) { edgeKinds[neighbor] = strong; stack.push(neighbor); }
          }
        }
      }
      const output = new Float64Array(width * height);
      let edgeCount = 0;
      for (let i = 0; i < edgeKinds.length; i += 1) {
        if (edgeKinds[i] === strong) { output[i] = 255; edgeCount += 1; }
      }
      const outputData = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < output.length; i += 1) {
        const val = Math.round(output[i]);
        outputData[i * 4] = val;
        outputData[i * 4 + 1] = val;
        outputData[i * 4 + 2] = val;
        outputData[i * 4 + 3] = 255;
      }
      return { resultData: Array.from(outputData), width, height, edgeCoverage: edgeCount / Math.max(1, width * height) };
    }

    self.onmessage = function(e) {
      const { imageData, width, height, blurSigma, lowThreshold, highThreshold } = e.data;
      const result = processCanny(imageData, width, height, blurSigma, lowThreshold, highThreshold);
      self.postMessage(result);
    };
  `;

  // Worker 孤兒清理：防止舊請求覆蓋新結果
  let activeShowcaseFFTWorker = null;
  let activeShowcaseCannyWorker = null;

  // Resize 防抖計時器
  let resizeTimeout = null;

  const showcaseContent = document.getElementById("showcaseContent");
  const topicButtons = Array.from(document.querySelectorAll("[data-showcase-topic]"));
  const showcaseLightbox = document.getElementById("showcaseLightbox");
  const showcaseLightboxViewport = document.getElementById("showcaseLightboxViewport");
  const showcaseLightboxCompare = document.getElementById("showcaseLightboxCompare");
  const showcaseLightboxMathSidebar = document.createElement("aside");
  showcaseLightboxMathSidebar.className = "showcase-lightbox__math-sidebar";
  showcaseLightboxMathSidebar.setAttribute("aria-label", "運算邏輯解析");
  showcaseLightboxViewport.insertBefore(showcaseLightboxMathSidebar, showcaseLightboxCompare);
  const showcaseLightboxZoomLayer = document.getElementById("showcaseLightboxZoomLayer");
  const showcaseLightboxSplit = document.getElementById("showcaseLightboxSplit");
  const showcaseLightboxPaneBefore = document.getElementById("showcaseLightboxPaneBefore");
  const showcaseLightboxPaneAfter = document.getElementById("showcaseLightboxPaneAfter");
  const showcaseLightboxBeforeCanvas = document.getElementById("showcaseLightboxBeforeCanvas");
  const showcaseLightboxAfterCanvas = document.getElementById("showcaseLightboxAfterCanvas");
  const showcaseLightboxTitle = document.getElementById("showcaseLightboxTitle");
  const showcaseLightboxDescription = document.getElementById("showcaseLightboxDescription");
  const showcaseLightboxBeforeLabel = document.getElementById("showcaseLightboxBeforeLabel");
  const showcaseLightboxAfterLabel = document.getElementById("showcaseLightboxAfterLabel");
  const showcaseLightboxBadgeRow = document.getElementById("showcaseLightboxBadgeRow");
  const showcaseLightboxClose = document.getElementById("showcaseLightboxClose");
  const showcaseLightboxFitBtn = document.getElementById("showcaseLightboxFitBtn");
  const showcaseLightboxZoom100Btn = document.getElementById("showcaseLightboxZoom100Btn");
  const showcaseLightboxZoom200Btn = document.getElementById("showcaseLightboxZoom200Btn");
  const showcaseLightboxResetBtn = document.getElementById("showcaseLightboxResetBtn");
  const showcaseLightboxZoomValue = document.getElementById("showcaseLightboxZoomValue");

  if (!showcaseContent || topicButtons.length === 0) {
    return;
  }

  const showcaseState = {
    topic: topicButtons.find((button) => button.classList.contains("active"))?.dataset.showcaseTopic || "brightness-contrast",
    imageAData: null,
    imageBData: null,
    fftCache: null,
    pcaCache: null,
    renderToken: 0,
    eventsBound: false,
    activeLightboxTrigger: null,
    lightboxPayload: null,
    lightboxZoom: 1,
    lightboxMinZoom: 1,
    lightboxMaxZoom: 5,
    lightboxFitScale: 1,
    lightboxContentWidth: 0,
    lightboxContentHeight: 0,
    lightboxTranslateX: 0,
    lightboxTranslateY: 0,
    isDragging: false,
    lightboxPointerId: null,
    lightboxDragStartX: 0,
    lightboxDragStartY: 0
  };

  function clampByte(value) {
    return Math.min(255, Math.max(0, Math.round(value)));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function cloneImageData(source) {
    return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  }

  function createCanvasContext(width, height, options = {}) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext("2d", { willReadFrequently: Boolean(options.willReadFrequently) });
  }

  function yieldToBrowser() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  function rgbaToLuma(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function isUsableImageData(imageData) {
    return Boolean(
      imageData &&
        Number.isFinite(imageData.width) &&
        Number.isFinite(imageData.height) &&
        imageData.width > 0 &&
        imageData.height > 0 &&
        imageData.data instanceof Uint8ClampedArray &&
        imageData.data.length === imageData.width * imageData.height * CHANNELS
    );
  }

  function resampleImageData(sourceImageData, targetWidth, targetHeight, options = {}) {
    const sourceCtx = createCanvasContext(sourceImageData.width, sourceImageData.height, { willReadFrequently: true });
    sourceCtx.putImageData(sourceImageData, 0, 0);
    const targetCtx = createCanvasContext(targetWidth, targetHeight, { willReadFrequently: true });
    targetCtx.imageSmoothingEnabled = options.smoothing !== false;
    targetCtx.clearRect(0, 0, targetWidth, targetHeight);
    targetCtx.drawImage(sourceCtx.canvas, 0, 0, targetWidth, targetHeight);
    // 釋放暫存 canvas 記憶體（行動裝置 Memory Bloat 優化）
    sourceCtx.canvas.width = 0;
    sourceCtx.canvas.height = 0;
    try {
      const result = targetCtx.getImageData(0, 0, targetWidth, targetHeight);
      targetCtx.canvas.width = 0;
      targetCtx.canvas.height = 0;
      return result;
    } catch (error) {
      targetCtx.canvas.width = 0;
      targetCtx.canvas.height = 0;
      console.warn("[Showcase] resampleImageData getImageData 失敗（tainted canvas），使用原始尺寸：", error);
      return sourceImageData;
    }
  }

  function normalizeShowcaseImageSize(sourceImageData) {
    const longEdge = Math.max(sourceImageData.width, sourceImageData.height);
    if (longEdge <= SHOWCASE_MAX_LONG_EDGE) {
      return sourceImageData;
    }

    const ratio = SHOWCASE_MAX_LONG_EDGE / longEdge;
    const targetWidth = Math.max(1, Math.round(sourceImageData.width * ratio));
    const targetHeight = Math.max(1, Math.round(sourceImageData.height * ratio));
    return resampleImageData(sourceImageData, targetWidth, targetHeight, { smoothing: true });
  }

  function scaleImageDataToSize(sourceImageData, width, height, options = {}) {
    return resampleImageData(sourceImageData, width, height, options);
  }

  function imageDataToGrayBuffer(sourceImageData, targetWidth, targetHeight) {
    const resized = resampleImageData(sourceImageData, targetWidth, targetHeight, { smoothing: true });
    const gray = new Float64Array(targetWidth * targetHeight);
    const data = resized.data;
    for (let i = 0, j = 0; i < data.length; i += CHANNELS, j += 1) {
      gray[j] = rgbaToLuma(data[i], data[i + 1], data[i + 2]);
    }
    return gray;
  }

  function grayBufferToImageData(grayValues, width, height) {
    const output = new ImageData(width, height);
    const data = output.data;
    for (let i = 0, j = 0; j < grayValues.length; i += CHANNELS, j += 1) {
      const value = clampByte(grayValues[j]);
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    return output;
  }

  function grayBufferToCanvasSizedImageData(grayValues, sourceWidth, sourceHeight, targetWidth, targetHeight) {
    return scaleImageDataToSize(
      grayBufferToImageData(grayValues, sourceWidth, sourceHeight),
      targetWidth,
      targetHeight,
      { smoothing: true }
    );
  }

  function grayBufferToRows(grayValues, width, height) {
    const rows = new Array(height);
    for (let y = 0; y < height; y += 1) {
      const row = new Float64Array(width);
      const offset = y * width;
      for (let x = 0; x < width; x += 1) {
        row[x] = grayValues[offset + x];
      }
      rows[y] = row;
    }
    return rows;
  }

  function cloneFloatRows(rows) {
    return rows.map((row) => Float64Array.from(row));
  }

  function buildPCAWorkSize(sourceWidth, sourceHeight) {
    if (sourceWidth >= sourceHeight) {
      return {
        width: PCA_LONG_EDGE,
        height: Math.max(PCA_MIN_SHORT_EDGE, Math.round((sourceHeight / sourceWidth) * PCA_LONG_EDGE))
      };
    }

    return {
      width: Math.max(PCA_MIN_SHORT_EDGE, Math.round((sourceWidth / sourceHeight) * PCA_LONG_EDGE)),
      height: PCA_LONG_EDGE
    };
  }

  function formatRatio(value) {
    if (!Number.isFinite(value) || value <= 0) {
      return "無資料";
    }
    return `${value.toFixed(value >= 10 ? 1 : 2)}x`;
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) {
      return "無資料";
    }
    return `${(value * 100).toFixed(1)}%`;
  }

  function formatCoverage(value) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function getTopicLabel(topic = showcaseState.topic) {
    const topicButton = topicButtons.find((button) => button.dataset.showcaseTopic === topic);
    return topicButton?.querySelector("strong")?.textContent?.trim() || "展示主題";
  }

  function loadImageElement(src, errorMessage = "無法載入示範影像。") {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(errorMessage));
      image.src = src;
    });
  }

  function imageElementToImageData(img) {
    const ctx = createCanvasContext(img.width, img.height, { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, img.width, img.height);
    const result = ctx.getImageData(0, 0, img.width, img.height);
    ctx.canvas.width = 0;
    ctx.canvas.height = 0;
    return result;
  }

  function canvasElementToImageData(canvas) {
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) {
      return null;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return null;
    }
    try {
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.warn("無法讀取 canvas 影像資料。", error);
      return null;
    }
  }

  function generateShowcaseFallbackImage() {
    const ctx = createCanvasContext(FALLBACK_WIDTH, FALLBACK_HEIGHT, { willReadFrequently: true });
    const gradient = ctx.createLinearGradient(0, 0, FALLBACK_WIDTH, FALLBACK_HEIGHT);
    gradient.addColorStop(0, "#11244c");
    gradient.addColorStop(0.5, "#1c5ca8");
    gradient.addColorStop(1, "#0f8a84");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FALLBACK_WIDTH, FALLBACK_HEIGHT);

    const radial = ctx.createRadialGradient(140, 90, 10, 140, 90, 180);
    radial.addColorStop(0, "rgba(255,255,255,0.55)");
    radial.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, FALLBACK_WIDTH, FALLBACK_HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    for (let x = 0; x <= FALLBACK_WIDTH; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FALLBACK_HEIGHT);
      ctx.stroke();
    }

    for (let y = 0; y <= FALLBACK_HEIGHT; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FALLBACK_WIDTH, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 120, 120, 0.9)";
    ctx.fillRect(220, 560, 320, 180);

    ctx.fillStyle = "rgba(126, 244, 191, 0.9)";
    ctx.beginPath();
    ctx.moveTo(780, 780);
    ctx.lineTo(1010, 420);
    ctx.lineTo(1320, 800);
    ctx.closePath();
    ctx.fill();

    return ctx.getImageData(0, 0, FALLBACK_WIDTH, FALLBACK_HEIGHT);
  }

  async function loadShowcaseBaseImage() {
    const isLocalFile = window.location.protocol === "file:";
    const dataUrl =
      typeof window !== "undefined" && typeof window.__FUJI_DEMO_DATA_URL === "string"
        ? window.__FUJI_DEMO_DATA_URL
        : "";

    // Local file 模式：直接用 Base64，徹底避開 ctx.getImageData SecurityError
    if (isLocalFile && dataUrl) {
      try {
        console.log("[Showcase] 本地模式：直接使用 Base64 示範圖，跳過 ./Fuji.png");
        const imageData = imageElementToImageData(await loadImageElement(dataUrl, "無法載入內嵌示範圖。"));
        return normalizeShowcaseImageSize(imageData);
      } catch (error) {
        console.warn("[Showcase] 內嵌示範圖載入失敗，改用保底圖：", error);
        return normalizeShowcaseImageSize(generateShowcaseFallbackImage());
      }
    }

    // HTTP/HTTPS 模式：先嘗試 ./Fuji.png，再 fallback
    try {
      const imageData = imageElementToImageData(
        await loadImageElement(SHOWCASE_FUJI_IMAGE_URL, "無法載入 Fuji 示範圖。")
      );
      return normalizeShowcaseImageSize(imageData);
    } catch (error) {
      console.warn("[Showcase] Fuji.png 載入失敗：", error);
    }

    // Fallback 1：嘗試 Base64 內嵌圖
    if (dataUrl) {
      try {
        console.log("[Showcase] Fallback：嘗試使用 Base64 內嵌示範圖");
        const imageData = imageElementToImageData(await loadImageElement(dataUrl, "無法載入內嵌示範圖。"));
        return normalizeShowcaseImageSize(imageData);
      } catch (error) {
        console.warn("[Showcase] 內嵌示範圖 Fallback 也失敗：", error);
      }
    }

    // Fallback 2：生成純程式生成的假圖（永不卡死）
    console.warn("[Showcase] 所有圖片載入均失敗，使用保底生成的假圖。");
    return normalizeShowcaseImageSize(generateShowcaseFallbackImage());
  }

  async function loadShowcaseSpecificImage(imageUrl, fallbackImageData) {
    const isLocalFile = window.location.protocol === "file:";

    // 本地模式：直接使用 fallback，避免跨域問題
    if (isLocalFile) {
      console.log(`[Showcase] 本地模式：跳過 ${imageUrl}，使用 fallback 圖`);
      return fallbackImageData ? normalizeShowcaseImageSize(fallbackImageData) : null;
    }

    try {
      const imageData = imageElementToImageData(
        await loadImageElement(imageUrl, `無法載入 ${imageUrl}。`)
      );
      return normalizeShowcaseImageSize(imageData);
    } catch (error) {
      console.warn(`[Showcase] ${imageUrl} 載入失敗，使用指定的 fallback 圖：`, error);
      return fallbackImageData ? normalizeShowcaseImageSize(fallbackImageData) : null;
    }
  }

  function applyBrightnessContrast(sourceImageData, brightness, contrast) {
    const output = cloneImageData(sourceImageData);
    const data = output.data;
    for (let i = 0; i < data.length; i += CHANNELS) {
      data[i] = clampByte((data[i] - 128) * contrast + 128 + brightness);
      data[i + 1] = clampByte((data[i + 1] - 128) * contrast + 128 + brightness);
      data[i + 2] = clampByte((data[i + 2] - 128) * contrast + 128 + brightness);
    }
    return output;
  }

  function buildShowcaseCompanionImage(sourceImageData) {
    const baseCtx = createCanvasContext(sourceImageData.width, sourceImageData.height, { willReadFrequently: true });
    baseCtx.putImageData(sourceImageData, 0, 0);
    const stylizedCtx = createCanvasContext(sourceImageData.width, sourceImageData.height, { willReadFrequently: true });
    stylizedCtx.drawImage(baseCtx.canvas, 0, 0);
    stylizedCtx.globalCompositeOperation = "screen";
    const screenWash = stylizedCtx.createLinearGradient(0, 0, sourceImageData.width, sourceImageData.height);
    screenWash.addColorStop(0, "rgba(96, 231, 255, 0.26)");
    screenWash.addColorStop(0.55, "rgba(122, 156, 255, 0.18)");
    screenWash.addColorStop(1, "rgba(255, 154, 198, 0.22)");
    stylizedCtx.fillStyle = screenWash;
    stylizedCtx.fillRect(0, 0, sourceImageData.width, sourceImageData.height);
    stylizedCtx.globalCompositeOperation = "multiply";
    const depthWash = stylizedCtx.createLinearGradient(0, sourceImageData.height, sourceImageData.width, 0);
    depthWash.addColorStop(0, "rgba(32, 58, 120, 0.24)");
    depthWash.addColorStop(1, "rgba(47, 22, 86, 0.34)");
    stylizedCtx.fillStyle = depthWash;
    stylizedCtx.fillRect(0, 0, sourceImageData.width, sourceImageData.height);
    stylizedCtx.globalCompositeOperation = "source-over";
    stylizedCtx.strokeStyle = "rgba(255,255,255,0.16)";
    stylizedCtx.lineWidth = 2;
    for (let x = -40; x < sourceImageData.width + sourceImageData.height; x += 82) {
      stylizedCtx.beginPath();
      stylizedCtx.moveTo(x, 0);
      stylizedCtx.lineTo(x - sourceImageData.height, sourceImageData.height);
      stylizedCtx.stroke();
    }
    let stylized;
    try {
      stylized = stylizedCtx.getImageData(0, 0, sourceImageData.width, sourceImageData.height);
      // 釋放暫存 canvas 記憶體
      baseCtx.canvas.width = 0;
      baseCtx.canvas.height = 0;
      stylizedCtx.canvas.width = 0;
      stylizedCtx.canvas.height = 0;
    } catch (error) {
      baseCtx.canvas.width = 0;
      baseCtx.canvas.height = 0;
      console.warn("[Showcase] getImageData 失敗（Canvas tainted），使用原圖替代 companion：", error);
      return cloneImageData(sourceImageData);
    }
    const stylizedBrightnessApplied = applyBrightnessContrast(stylized, 18, 1.08);
    const data = stylizedBrightnessApplied.data;
    const width = stylizedBrightnessApplied.width;
    const height = stylizedBrightnessApplied.height;
    for (let index = 0, pixel = 0; index < data.length; index += CHANNELS, pixel += 1) {
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const xRatio = x / Math.max(1, width - 1);
      const yRatio = y / Math.max(1, height - 1);
      data[index] = clampByte(data[index] * (0.82 + xRatio * 0.18) + 10);
      data[index + 1] = clampByte(data[index + 1] * 0.92 + 14 * (1 - yRatio));
      data[index + 2] = clampByte(data[index + 2] * (1.05 + (1 - xRatio) * 0.08) + 22);
    }
    return stylizedBrightnessApplied;
  }

  function blendTwoImages(imageAData, imageBData, alpha) {
    if (!imageAData || !imageBData) {
      return null;
    }

    const output = cloneImageData(imageAData);
    const aData = imageAData.data;
    const bData = imageBData.data;
    const out = output.data;
    const beta = 1 - alpha;
    for (let i = 0; i < out.length; i += CHANNELS) {
      out[i] = clampByte(alpha * aData[i] + beta * bData[i]);
      out[i + 1] = clampByte(alpha * aData[i + 1] + beta * bData[i + 1]);
      out[i + 2] = clampByte(alpha * aData[i + 2] + beta * bData[i + 2]);
      out[i + 3] = 255;
    }
    return output;
  }

  function applyPixelation(sourceImageData, blockSize) {
    const output = cloneImageData(sourceImageData);
    const src = sourceImageData.data;
    const out = output.data;
    const width = sourceImageData.width;
    const height = sourceImageData.height;
    for (let by = 0; by < height; by += blockSize) {
      for (let bx = 0; bx < width; bx += blockSize) {
        const endX = Math.min(width, bx + blockSize);
        const endY = Math.min(height, by + blockSize);
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;
        for (let y = by; y < endY; y += 1) {
          for (let x = bx; x < endX; x += 1) {
            const idx = (y * width + x) * CHANNELS;
            sumR += src[idx];
            sumG += src[idx + 1];
            sumB += src[idx + 2];
            count += 1;
          }
        }
        const avgR = Math.round(sumR / count);
        const avgG = Math.round(sumG / count);
        const avgB = Math.round(sumB / count);
        for (let y = by; y < endY; y += 1) {
          for (let x = bx; x < endX; x += 1) {
            const idx = (y * width + x) * CHANNELS;
            out[idx] = avgR;
            out[idx + 1] = avgG;
            out[idx + 2] = avgB;
            out[idx + 3] = src[idx + 3];
          }
        }
      }
    }
    return output;
  }

  // LSB 隱寫術：隱藏訊息 (encoding) — 使用 TextEncoder 支援中文
  function encodeLSB(sourceImageData, message) {
    const output = cloneImageData(sourceImageData);
    const data = output.data;
    const width = sourceImageData.width;
    const height = sourceImageData.height;
    const encoder = new TextEncoder();
    // 先編碼完整訊息，取得實際位元組數（而非字元數，避免 emoji 等多字節字元造成截斷偏差）
    let payloadBytes = Array.from(encoder.encode(message));
    const maxBytes = Math.floor((width * height * 3) / 8);
    if (payloadBytes.length > maxBytes) {
      // 使用字元逐個累計的方式，確保在完整的字元邊界處截斷
      // 避免在多 byte 字元（如中文）的中間切斷造成亂碼
      let truncatedBytes = [];
      const decoder = new TextDecoder("utf-8");
      for (let i = 0; i < message.length && truncatedBytes.length < maxBytes; i++) {
        const charBytes = encoder.encode(message[i]);
        if (truncatedBytes.length + charBytes.length <= maxBytes) {
          truncatedBytes.push(...charBytes);
        } else {
          // 這個字元裝不下，停止截斷
          break;
        }
      }
      payloadBytes = truncatedBytes;
    }
    // 終止序列：0x00 (NULL byte，TextDecoder 會在遇到時停止)
    payloadBytes.push(0);
    let bitIndex = 0;
    const totalBits = payloadBytes.length * 8;
    for (let i = 0; i < data.length; i += 4) {
      if (bitIndex >= totalBits) break;
      data[i] = (data[i] & 0xFE) | ((payloadBytes[Math.floor(bitIndex / 8)] >> (7 - (bitIndex % 8))) & 1);
      bitIndex += 1;
      if (bitIndex >= totalBits) break;
      data[i + 1] = (data[i + 1] & 0xFE) | ((payloadBytes[Math.floor(bitIndex / 8)] >> (7 - (bitIndex % 8))) & 1);
      bitIndex += 1;
      if (bitIndex >= totalBits) break;
      data[i + 2] = (data[i + 2] & 0xFE) | ((payloadBytes[Math.floor(bitIndex / 8)] >> (7 - (bitIndex % 8))) & 1);
      bitIndex += 1;
    }
    return output;
  }

  // LSB 隱寫術：取出訊息 (decoding) — 使用 TextDecoder 支援中文
  function decodeLSB(sourceImageData) {
    const data = sourceImageData.data;
    const bytes = [];
    let currentByte = 0;
    let bitCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const bit0 = data[i] & 1;
      currentByte = (currentByte << 1) | bit0;
      bitCount += 1;
      if (bitCount === 8) {
        if (currentByte === 0) break; // 遇到 NULL terminator 即停止
        bytes.push(currentByte);
        currentByte = 0;
        bitCount = 0;
      }
      const bit1 = data[i + 1] & 1;
      currentByte = (currentByte << 1) | bit1;
      bitCount += 1;
      if (bitCount === 8) {
        if (currentByte === 0) break;
        bytes.push(currentByte);
        currentByte = 0;
        bitCount = 0;
      }
      const bit2 = data[i + 2] & 1;
      currentByte = (currentByte << 1) | bit2;
      bitCount += 1;
      if (bitCount === 8) {
        if (currentByte === 0) break;
        bytes.push(currentByte);
        currentByte = 0;
        bitCount = 0;
      }
    }
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(new Uint8Array(bytes));
  }

  // LSB 展示用：對原圖執行強烈模糊，模擬破壞隱藏訊息
  function applyLSBDestroy(sourceImageData) {
    const blurred = applyConvolution(sourceImageData, buildGaussianKernel(9, 3.5));
    return blurred;
  }

  function buildGaussianKernel(size, sigma) {
    const safeSize = Math.max(3, Math.min(9, Math.round(size) | 1));
    const safeSigma = Math.max(0.6, sigma);
    const center = Math.floor(safeSize / 2);
    const kernel = Array.from({ length: safeSize }, () => new Float64Array(safeSize));
    let sum = 0;
    for (let y = 0; y < safeSize; y += 1) {
      for (let x = 0; x < safeSize; x += 1) {
        const dx = x - center;
        const dy = y - center;
        const value = Math.exp(-(dx * dx + dy * dy) / (2 * safeSigma * safeSigma));
        kernel[y][x] = value;
        sum += value;
      }
    }
    if (sum > 0) {
      for (let y = 0; y < safeSize; y += 1) {
        for (let x = 0; x < safeSize; x += 1) {
          kernel[y][x] /= sum;
        }
      }
    }
    return kernel;
  }

  function buildSharpenKernel(amount) {
    const safeAmount = clamp(amount, 0.2, 3);
    return [
      new Float64Array([0, -safeAmount, 0]),
      new Float64Array([-safeAmount, 1 + safeAmount * 4, -safeAmount]),
      new Float64Array([0, -safeAmount, 0])
    ];
  }

  function applyConvolution(sourceImageData, kernel, options = {}) {
    const output = cloneImageData(sourceImageData);
    const src = sourceImageData.data;
    const out = output.data;
    const width = sourceImageData.width;
    const height = sourceImageData.height;
    const kernelHeight = kernel.length;
    const kernelWidth = kernel[0].length;
    const halfY = Math.floor(kernelHeight / 2);
    const halfX = Math.floor(kernelWidth / 2);
    const grayscale = Boolean(options.grayscale);
    const bias = Number.isFinite(options.bias) ? options.bias : 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        for (let ky = 0; ky < kernelHeight; ky += 1) {
          const py = clamp(y + ky - halfY, 0, height - 1);
          for (let kx = 0; kx < kernelWidth; kx += 1) {
            const px = clamp(x + kx - halfX, 0, width - 1);
            const idx = (py * width + px) * CHANNELS;
            const weight = kernel[ky][kx];
            if (grayscale) {
              sumR += rgbaToLuma(src[idx], src[idx + 1], src[idx + 2]) * weight;
            } else {
              sumR += src[idx] * weight;
              sumG += src[idx + 1] * weight;
              sumB += src[idx + 2] * weight;
            }
          }
        }
        const outIndex = (y * width + x) * CHANNELS;
        if (grayscale) {
          const value = clampByte(sumR + bias);
          out[outIndex] = value;
          out[outIndex + 1] = value;
          out[outIndex + 2] = value;
        } else {
          out[outIndex] = clampByte(sumR + bias);
          out[outIndex + 1] = clampByte(sumG + bias);
          out[outIndex + 2] = clampByte(sumB + bias);
        }
        out[outIndex + 3] = src[outIndex + 3];
      }
    }
    return output;
  }

  function applyEdgeDetection(sourceImageData, strength) {
    const output = cloneImageData(sourceImageData);
    const src = sourceImageData.data;
    const out = output.data;
    const width = sourceImageData.width;
    const height = sourceImageData.height;
    const gxKernel = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const gyKernel = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    const boost = clamp(strength, 0.4, 2.8);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let gradX = 0;
        let gradY = 0;
        for (let ky = 0; ky < 3; ky += 1) {
          const py = clamp(y + ky - 1, 0, height - 1);
          for (let kx = 0; kx < 3; kx += 1) {
            const px = clamp(x + kx - 1, 0, width - 1);
            const idx = (py * width + px) * CHANNELS;
            const luma = rgbaToLuma(src[idx], src[idx + 1], src[idx + 2]);
            gradX += luma * gxKernel[ky][kx];
            gradY += luma * gyKernel[ky][kx];
          }
        }
        const value = clampByte(Math.min(255, Math.hypot(gradX, gradY) * boost));
        const outIndex = (y * width + x) * CHANNELS;
        out[outIndex] = value;
        out[outIndex + 1] = value;
        out[outIndex + 2] = value;
        out[outIndex + 3] = src[outIndex + 3];
      }
    }
    return output;
  }

  function buildShowcaseSpatialFilterImage(sourceImageData, mode, strength) {
    if (mode === "gaussian") {
      return applyConvolution(sourceImageData, buildGaussianKernel(7, 2.1));
    }
    if (mode === "sharpen") {
      return applyConvolution(sourceImageData, buildSharpenKernel(strength / 100));
    }
    return applyEdgeDetection(sourceImageData, strength / 100);
  }

  async function ensureShowcaseFFTCache(baseImageData) {
    if (showcaseState.fftCache && showcaseState.fftCache.baseImageData === baseImageData) {
      return showcaseState.fftCache;
    }
    const grayBuffer = imageDataToGrayBuffer(baseImageData, FFT_WORK_WIDTH, FFT_WORK_HEIGHT);
    showcaseState.fftCache = {
      baseImageData,
      width: FFT_WORK_WIDTH,
      height: FFT_WORK_HEIGHT,
      grayBuffer
    };
    return showcaseState.fftCache;
  }

  // 注意：此函式內部會 terminate() 前一個 activeShowcaseFFTWorker。
  // 目前呼叫端（renderShowcaseFFT）以 await 序列化呼叫，確保不會並發，因此不會互殺。
  // 若未來改為 Promise.all 或任何形式的平行呼叫，將導致 Worker 互殺造成 race condition。
  async function runShowcaseFFT(grayBuffer, width, height, mode, strengthValue) {
    return new Promise((resolve, reject) => {
      // 取消前一次尚未完成的 Worker，釋放 Blob URL 與記憶體
      if (activeShowcaseFFTWorker) {
        activeShowcaseFFTWorker.terminate();
        activeShowcaseFFTWorker = null;
      }

      const { worker, terminate, aborted } = createInlineWorker(SHOWCASE_FFT_WORKER_SOURCE);
      activeShowcaseFFTWorker = { terminate };

      const handleMessage = (e) => {
        if (aborted()) return; // 任務已被取消，忽略遲到的回應
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        resolve(e.data);
        // 延後 100ms 終止 Worker，防止瀏覽器過早回收記憶體導致畫面閃爍
        setTimeout(() => {
          terminate();
          activeShowcaseFFTWorker = null;
        }, 100);
      };

      const handleError = (err) => {
        if (aborted()) return;
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        terminate();
        activeShowcaseFFTWorker = null;
        reject(err);
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);

      try {
        worker.postMessage({
          grayBuffer: Array.from(grayBuffer),
          width,
          height,
          mode,
          strengthValue
        });
      } catch (syncError) {
        terminate();
        activeShowcaseFFTWorker = null;
        reject(syncError);
      }
    });
  }

  function buildShowcaseFFTResult(cache, mode, strengthValue, workerResult) {
    const targetWidth = cache.baseImageData.width;
    const targetHeight = cache.baseImageData.height;
    if (mode === "spectrum") {
      return grayBufferToCanvasSizedImageData(
        workerResult.spectrumImageData,
        workerResult.width,
        workerResult.height,
        targetWidth,
        targetHeight
      );
    }
    return grayBufferToCanvasSizedImageData(
      workerResult.outputData,
      workerResult.width,
      workerResult.height,
      targetWidth,
      targetHeight
    );
  }

  function buildCovarianceMatrix(centeredRows, width, height) {
    const covariance = Array.from({ length: width }, () => new Float64Array(width));
    const denom = Math.max(1, height - 1);
    for (let y = 0; y < height; y += 1) {
      const row = centeredRows[y];
      for (let i = 0; i < width; i += 1) {
        const vi = row[i];
        for (let j = i; j < width; j += 1) {
          covariance[i][j] += vi * row[j];
        }
      }
    }
    for (let i = 0; i < width; i += 1) {
      for (let j = i; j < width; j += 1) {
        covariance[i][j] /= denom;
        if (i !== j) {
          covariance[j][i] = covariance[i][j];
        }
      }
    }
    return covariance;
  }

  function jacobiEigenSymmetric(matrix) {
    const size = matrix.length;
    const a = matrix.map((row) => Float64Array.from(row));
    const eigenvectors = Array.from({ length: size }, (_, rowIndex) => {
      const row = new Float64Array(size);
      row[rowIndex] = 1;
      return row;
    });
    const maxSweeps = Math.max(18, Math.ceil(Math.log2(size + 1)) * 6);
    for (let sweep = 0; sweep < maxSweeps; sweep += 1) {
      let changed = false;
      for (let p = 0; p < size - 1; p += 1) {
        for (let q = p + 1; q < size; q += 1) {
          const apq = a[p][q];
          if (Math.abs(apq) < PCA_EIGEN_EPSILON) {
            continue;
          }
          changed = true;
          const app = a[p][p];
          const aqq = a[q][q];
          const tau = (aqq - app) / (2 * apq);
          const t = Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
          const cosine = 1 / Math.sqrt(1 + t * t);
          const sine = t * cosine;
          for (let k = 0; k < size; k += 1) {
            if (k === p || k === q) {
              continue;
            }
            const akp = a[k][p];
            const akq = a[k][q];
            a[k][p] = akp * cosine - akq * sine;
            a[p][k] = a[k][p];
            a[k][q] = akp * sine + akq * cosine;
            a[q][k] = a[k][q];
          }
          a[p][p] = app * cosine * cosine - 2 * apq * cosine * sine + aqq * sine * sine;
          a[q][q] = app * sine * sine + 2 * apq * cosine * sine + aqq * cosine * cosine;
          a[p][q] = 0;
          a[q][p] = 0;
          for (let k = 0; k < size; k += 1) {
            const vip = eigenvectors[k][p];
            const viq = eigenvectors[k][q];
            eigenvectors[k][p] = vip * cosine - viq * sine;
            eigenvectors[k][q] = vip * sine + viq * cosine;
          }
        }
      }
      if (!changed) {
        break;
      }
    }
    const eigenvalues = new Float64Array(size);
    for (let i = 0; i < size; i += 1) {
      eigenvalues[i] = a[i][i];
    }
    return { eigenvalues, eigenvectors };
  }

  function sortEigenPairsDescending(eigenvalues, eigenvectors) {
    const order = Array.from(eigenvalues.keys()).sort((left, right) => eigenvalues[right] - eigenvalues[left]);
    const sortedValues = Float64Array.from(order.map((index) => Math.max(0, eigenvalues[index])));
    const sortedVectors = Array.from({ length: eigenvectors.length }, (_, rowIndex) => {
      const row = new Float64Array(order.length);
      for (let i = 0; i < order.length; i += 1) {
        row[i] = eigenvectors[rowIndex][order[i]];
      }
      return row;
    });
    return { eigenvalues: sortedValues, eigenvectors: sortedVectors };
  }

  function projectScores(centeredRows, eigenvectors, componentCount) {
    const height = centeredRows.length;
    const width = centeredRows[0].length;
    const scoresRows = Array.from({ length: height }, () => new Float64Array(componentCount));
    for (let y = 0; y < height; y += 1) {
      const row = centeredRows[y];
      const scores = scoresRows[y];
      for (let component = 0; component < componentCount; component += 1) {
        let sum = 0;
        for (let x = 0; x < width; x += 1) {
          sum += row[x] * eigenvectors[x][component];
        }
        scores[component] = sum;
      }
    }
    return scoresRows;
  }

  async function ensureShowcasePCACache(baseImageData) {
    if (showcaseState.pcaCache && showcaseState.pcaCache.baseImageData === baseImageData) {
      return showcaseState.pcaCache;
    }
    const workSize = buildPCAWorkSize(baseImageData.width, baseImageData.height);
    const grayBuffer = imageDataToGrayBuffer(baseImageData, workSize.width, workSize.height);
    const grayRows = grayBufferToRows(grayBuffer, workSize.width, workSize.height);
    const meanVector = new Float64Array(workSize.width);
    for (let x = 0; x < workSize.width; x += 1) {
      let sum = 0;
      for (let y = 0; y < workSize.height; y += 1) {
        sum += grayRows[y][x];
      }
      meanVector[x] = sum / workSize.height;
    }
    const centeredRows = grayRows.map((row) => {
      const centered = new Float64Array(workSize.width);
      for (let x = 0; x < workSize.width; x += 1) {
        centered[x] = row[x] - meanVector[x];
      }
      return centered;
    });
    const covariance = buildCovarianceMatrix(centeredRows, workSize.width, workSize.height);
    await yieldToBrowser();
    const eigen = jacobiEigenSymmetric(covariance);
    const sorted = sortEigenPairsDescending(eigen.eigenvalues, eigen.eigenvectors);
    const scoresRows = projectScores(centeredRows, sorted.eigenvectors, sorted.eigenvalues.length);
    const totalVariance = sorted.eigenvalues.reduce((sum, value) => sum + Math.max(0, value), 0);
    let rank = 0;
    for (let i = 0; i < sorted.eigenvalues.length; i += 1) {
      if (sorted.eigenvalues[i] > PCA_EIGEN_EPSILON) {
        rank += 1;
      }
    }
    showcaseState.pcaCache = {
      baseImageData,
      width: workSize.width,
      height: workSize.height,
      meanVector,
      eigenvalues: sorted.eigenvalues,
      eigenvectors: sorted.eigenvectors,
      scoresRows,
      totalVariance,
      rank: Math.max(1, rank)
    };
    return showcaseState.pcaCache;
  }

  function buildShowcasePCAResult(cache, retentionPercent) {
    const componentCount = Math.max(
      1,
      Math.min(cache.rank, Math.ceil((cache.rank * clamp(retentionPercent, 10, 95)) / 100))
    );
    const reconstruction = new Float64Array(cache.width * cache.height);
    for (let y = 0; y < cache.height; y += 1) {
      const scores = cache.scoresRows[y];
      const rowOffset = y * cache.width;
      for (let x = 0; x < cache.width; x += 1) {
        let value = cache.meanVector[x];
        for (let component = 0; component < componentCount; component += 1) {
          value += scores[component] * cache.eigenvectors[x][component];
        }
        reconstruction[rowOffset + x] = clamp(value, 0, 255);
      }
    }
    let keptVariance = 0;
    for (let i = 0; i < componentCount; i += 1) {
      keptVariance += Math.max(0, cache.eigenvalues[i]);
    }
    const originalElements = cache.width * cache.height;
    const compressedElements = cache.height * componentCount + cache.width * componentCount + cache.width;
    return {
      imageData: grayBufferToCanvasSizedImageData(
        reconstruction,
        cache.width,
        cache.height,
        cache.baseImageData.width,
        cache.baseImageData.height
      ),
      compressionRatio: originalElements / Math.max(1, compressedElements),
      infoRetention: cache.totalVariance > 0 ? keptVariance / cache.totalVariance : 1
    };
  }

  function buildShowcaseFFTFallbackResult(sourceImageData, mode, strengthValue) {
    if (mode === "lowpass") {
      return applyConvolution(sourceImageData, buildGaussianKernel(9, 2 + clamp(strengthValue / 45, 0.6, 2.6)));
    }
    if (mode === "highpass") {
      return applyEdgeDetection(sourceImageData, 0.8 + clamp(strengthValue / 45, 0.5, 2.4));
    }
    const fallbackWidth = 256;
    const fallbackHeight = Math.max(160, Math.round((sourceImageData.height / sourceImageData.width) * fallbackWidth));
    const reduced = scaleImageDataToSize(sourceImageData, fallbackWidth, fallbackHeight, { smoothing: true });
    const gray = grayBufferToImageData(
      imageDataToGrayBuffer(reduced, fallbackWidth, fallbackHeight),
      fallbackWidth,
      fallbackHeight
    );
    const edges = applyEdgeDetection(gray, 1.35);
    return scaleImageDataToSize(edges, sourceImageData.width, sourceImageData.height, { smoothing: false });
  }

  function buildShowcasePCAFallbackResult(sourceImageData, retentionPercent) {
    const normalizedRetention = clamp(retentionPercent / 100, 0.1, 0.95);
    const shortEdge = Math.max(28, Math.round(24 + normalizedRetention * 84));
    const aspectRatio = sourceImageData.width / Math.max(1, sourceImageData.height);
    const reducedWidth = aspectRatio >= 1 ? Math.max(36, Math.round(shortEdge * aspectRatio)) : Math.max(28, shortEdge);
    const reducedHeight =
      aspectRatio >= 1
        ? Math.max(28, shortEdge)
        : Math.max(36, Math.round(shortEdge / Math.max(aspectRatio, 1e-3)));
    const reduced = scaleImageDataToSize(sourceImageData, reducedWidth, reducedHeight, { smoothing: true });
    const rebuilt = scaleImageDataToSize(reduced, sourceImageData.width, sourceImageData.height, { smoothing: false });
    const grayscale = grayBufferToImageData(
      imageDataToGrayBuffer(rebuilt, sourceImageData.width, sourceImageData.height),
      sourceImageData.width,
      sourceImageData.height
    );
    return {
      imageData: grayscale,
      compressionRatio: null,
      infoRetention: null
    };
  }

  function quantizeDirection(angle) {
    const normalized = ((angle * 180) / Math.PI + 180) % 180;
    if (normalized < 22.5 || normalized >= 157.5) {
      return 0;
    }
    if (normalized < 67.5) {
      return 45;
    }
    if (normalized < 112.5) {
      return 90;
    }
    return 135;
  }

  function buildGaussianKernel1D(blurSigma) {
    const sigma = Math.max(0.8, blurSigma);
    const radius = Math.max(1, Math.ceil(sigma * 2));
    const kernel = new Float64Array(radius * 2 + 1);
    let sum = 0;
    for (let i = -radius; i <= radius; i += 1) {
      const value = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel[i + radius] = value;
      sum += value;
    }
    for (let i = 0; i < kernel.length; i += 1) {
      kernel[i] /= sum;
    }
    return { kernel, radius };
  }

  function gaussianBlurGrayBuffer(grayBuffer, width, height, blurSigma) {
    const { kernel, radius } = buildGaussianKernel1D(blurSigma);
    const temp = new Float64Array(grayBuffer.length);
    const output = new Float64Array(grayBuffer.length);
    for (let y = 0; y < height; y += 1) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const px = clamp(x + k, 0, width - 1);
          sum += grayBuffer[rowOffset + px] * kernel[k + radius];
        }
        temp[rowOffset + x] = sum;
      }
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const py = clamp(y + k, 0, height - 1);
          sum += temp[py * width + x] * kernel[k + radius];
        }
        output[y * width + x] = sum;
      }
    }
    return output;
  }

  function computeCannyEdgeDataFallback(sourceImageData, blurSigma, lowThreshold, highThreshold) {
    const width = sourceImageData.width;
    const height = sourceImageData.height;
    const gray = imageDataToGrayBuffer(sourceImageData, width, height);
    const blurred = gaussianBlurGrayBuffer(gray, width, height, blurSigma);
    const magnitude = new Float64Array(width * height);
    const direction = new Uint8Array(width * height);
    let maxMagnitude = 0;
    const gxKernel = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const gyKernel = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        let gradX = 0;
        let gradY = 0;
        for (let ky = 0; ky < 3; ky += 1) {
          for (let kx = 0; kx < 3; kx += 1) {
            const px = x + kx - 1;
            const py = y + ky - 1;
            const value = blurred[py * width + px];
            gradX += value * gxKernel[ky][kx];
            gradY += value * gyKernel[ky][kx];
          }
        }
        const mag = Math.hypot(gradX, gradY);
        const index = y * width + x;
        magnitude[index] = mag;
        direction[index] = quantizeDirection(Math.atan2(gradY, gradX));
        if (mag > maxMagnitude) {
          maxMagnitude = mag;
        }
      }
    }
    const normalizedMagnitude = new Float64Array(width * height);
    const scale = maxMagnitude > 0 ? 255 / maxMagnitude : 0;
    for (let i = 0; i < magnitude.length; i += 1) {
      normalizedMagnitude[i] = magnitude[i] * scale;
    }
    const suppressed = new Float64Array(width * height);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        const value = normalizedMagnitude[index];
        let neighborA = 0;
        let neighborB = 0;
        const dir = direction[index];
        if (dir === 0) {
          neighborA = normalizedMagnitude[index - 1];
          neighborB = normalizedMagnitude[index + 1];
        } else if (dir === 45) {
          neighborA = normalizedMagnitude[index - width + 1];
          neighborB = normalizedMagnitude[index + width - 1];
        } else if (dir === 90) {
          neighborA = normalizedMagnitude[index - width];
          neighborB = normalizedMagnitude[index + width];
        } else {
          neighborA = normalizedMagnitude[index - width - 1];
          neighborB = normalizedMagnitude[index + width + 1];
        }
        suppressed[index] = value >= neighborA && value >= neighborB ? value : 0;
      }
    }
    const strong = 2;
    const weak = 1;
    const edgeKinds = new Uint8Array(width * height);
    const stack = [];
    for (let i = 0; i < suppressed.length; i += 1) {
      if (suppressed[i] >= highThreshold) {
        edgeKinds[i] = strong;
        stack.push(i);
      } else if (suppressed[i] >= lowThreshold) {
        edgeKinds[i] = weak;
      }
    }
    while (stack.length > 0) {
      const index = stack.pop();
      const x = index % width;
      const y = Math.floor(index / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || px >= width || py < 0 || py >= height) {
            continue;
          }
          const neighbor = py * width + px;
          if (edgeKinds[neighbor] === weak) {
            edgeKinds[neighbor] = strong;
            stack.push(neighbor);
          }
        }
      }
    }
    const output = new Float64Array(width * height);
    let edgeCount = 0;
    for (let i = 0; i < edgeKinds.length; i += 1) {
      if (edgeKinds[i] === strong) {
        output[i] = 255;
        edgeCount += 1;
      }
    }
    return {
      imageData: grayBufferToImageData(output, width, height),
      edgeCoverage: edgeCount / Math.max(1, width * height)
    };
  }

  // 使用 Worker 執行 Canny 邊緣偵測
  async function computeCannyEdgeData(sourceImageData, blurSigma, lowThreshold, highThreshold) {
    return new Promise((resolve, reject) => {
      if (activeShowcaseCannyWorker) {
        activeShowcaseCannyWorker.terminate();
        activeShowcaseCannyWorker = null;
      }

      const { worker, terminate, aborted } = createInlineWorker(SHOWCASE_CANNY_WORKER_SOURCE);
      activeShowcaseCannyWorker = { terminate };

      const handleMessage = (e) => {
        if (aborted()) return; // 任務已被取消，忽略遲到的回應
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        const { resultData, width, height, edgeCoverage } = e.data;
        const resultImageData = new ImageData(new Uint8ClampedArray(resultData), width, height);
        resolve({ imageData: resultImageData, edgeCoverage });
        // 延後 100ms 終止 Worker，防止瀏覽器過早回收記憶體導致畫面閃爍
        setTimeout(() => {
          terminate();
          activeShowcaseCannyWorker = null;
        }, 100);
      };

      const handleError = (err) => {
        if (aborted()) return;
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        terminate();
        activeShowcaseCannyWorker = null;
        reject(err);
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);

      try {
        worker.postMessage({
          imageData: Array.from(sourceImageData.data),
          width: sourceImageData.width,
          height: sourceImageData.height,
          blurSigma,
          lowThreshold,
          highThreshold
        });
      } catch (syncError) {
        terminate();
        activeShowcaseCannyWorker = null;
        reject(syncError);
      }
    });
  }

  function createEmptyState(eyebrow, title, message) {
    const wrapper = document.createElement("div");
    wrapper.className = "showcase-empty";
    const eyebrowEl = document.createElement("p");
    eyebrowEl.className = "showcase-empty__eyebrow";
    eyebrowEl.textContent = eyebrow;
    const titleEl = document.createElement("h3");
    titleEl.textContent = title;
    const messageEl = document.createElement("p");
    messageEl.textContent = message;
    wrapper.appendChild(eyebrowEl);
    wrapper.appendChild(titleEl);
    wrapper.appendChild(messageEl);
    return wrapper;
  }

  function createLoadingState(title, message) {
    const wrapper = document.createElement("div");
    wrapper.className = "showcase-loading";
    const intro = document.createElement("div");
    intro.className = "showcase-loading__intro";
    const eyebrowEl = document.createElement("p");
    eyebrowEl.className = "showcase-empty__eyebrow";
    eyebrowEl.textContent = "載入中";
    const titleEl = document.createElement("h3");
    titleEl.textContent = title;
    const messageEl = document.createElement("p");
    messageEl.textContent = message;
    const hintEl = document.createElement("p");
    hintEl.className = "showcase-loading__hint";
    hintEl.textContent = `目前正在建立「${getTopicLabel()}」的固定案例與前後對比骨架，頁面會保持可回應狀態。`;
    intro.appendChild(eyebrowEl);
    intro.appendChild(titleEl);
    intro.appendChild(messageEl);
    intro.appendChild(hintEl);

    const grid = document.createElement("div");
    grid.className = "showcase-loading__grid";
    for (let i = 0; i < 3; i += 1) {
      const card = document.createElement("div");
      card.className = "showcase-loading-card";
      const lineA = document.createElement("span");
      lineA.className = "showcase-skeleton showcase-skeleton--line showcase-skeleton--title";
      const lineB = document.createElement("span");
      lineB.className = "showcase-skeleton showcase-skeleton--line";
      const media = document.createElement("span");
      media.className = "showcase-skeleton showcase-skeleton--media";
      const lineC = document.createElement("span");
      lineC.className = "showcase-skeleton showcase-skeleton--line showcase-skeleton--short";
      card.appendChild(lineA);
      card.appendChild(lineB);
      card.appendChild(media);
      card.appendChild(lineC);
      grid.appendChild(card);
    }
    wrapper.appendChild(intro);
    wrapper.appendChild(grid);
    return wrapper;
  }

  function setShowcaseLoading(title, message) {
    showcaseContent.setAttribute("aria-busy", "true");
    showcaseContent.classList.add("is-loading");
    showcaseContent.replaceChildren(createLoadingState(title, message));
  }

  function createShowcaseBadge(text) {
    const badge = document.createElement("span");
    badge.className = "showcase-badge";
    badge.textContent = text;
    return badge;
  }

  function decoratePreviewCanvas(canvas, label, isCompare = false, payload = null) {
    canvas.classList.add("showcase-preview-trigger");
    canvas.dataset.previewLabel = label;
    canvas.dataset.compare = isCompare ? "true" : "false";
    canvas.__showcaseLightboxPayload = payload;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "button");
    canvas.setAttribute("aria-haspopup", "dialog");
    canvas.setAttribute("title", isCompare ? "點擊放大查看前後對比" : "點擊放大查看影像");
  }

  function buildBadgeRow(items, className = "showcase-badge-row") {
    const row = document.createElement("div");
    row.className = className;
    items.forEach((item) => {
      row.appendChild(createShowcaseBadge(item));
    });
    return row;
  }

  function updateShowcaseLightboxReadout() {
    if (!showcaseLightboxZoomValue) {
      return;
    }
    const actualScale = showcaseState.lightboxFitScale * showcaseState.lightboxZoom;
    const nextValue = Math.abs(showcaseState.lightboxZoom - 1) < 0.001 ? "FIT" : `${Math.round(actualScale * 100)}%`;
    showcaseLightboxZoomValue.value = nextValue;
    showcaseLightboxZoomValue.textContent = nextValue;
  }

  function clampShowcaseLightboxTranslation() {
    if (
      !showcaseLightboxCompare ||
      !showcaseState.lightboxPayload ||
      showcaseState.lightboxContentWidth <= 0 ||
      showcaseState.lightboxContentHeight <= 0
    ) {
      showcaseState.lightboxTranslateX = 0;
      showcaseState.lightboxTranslateY = 0;
      return;
    }
    const viewportWidth = showcaseLightboxCompare.clientWidth;
    const viewportHeight = showcaseLightboxCompare.clientHeight;
    const totalScale = showcaseState.lightboxFitScale * showcaseState.lightboxZoom;
    const contentWidth = showcaseState.lightboxContentWidth * totalScale;
    const contentHeight = showcaseState.lightboxContentHeight * totalScale;
    const maxTranslateX = Math.max(0, (contentWidth - viewportWidth) / 2);
    const maxTranslateY = Math.max(0, (contentHeight - viewportHeight) / 2);
    showcaseState.lightboxTranslateX = clamp(showcaseState.lightboxTranslateX, -maxTranslateX, maxTranslateX);
    showcaseState.lightboxTranslateY = clamp(showcaseState.lightboxTranslateY, -maxTranslateY, maxTranslateY);
  }

  function updateShowcaseLightboxTransform() {
    if (!showcaseLightboxZoomLayer || !showcaseState.lightboxPayload) {
      return;
    }
    clampShowcaseLightboxTranslation();
    const totalScale = showcaseState.lightboxFitScale * showcaseState.lightboxZoom;
    showcaseLightboxZoomLayer.style.transform = `translate(-50%, -50%) translate(${showcaseState.lightboxTranslateX}px, ${showcaseState.lightboxTranslateY}px) scale(${totalScale})`;
    showcaseLightboxCompare?.classList.toggle("is-zoomed", showcaseState.lightboxZoom > 1.001);
    showcaseLightboxCompare?.classList.toggle("is-dragging", showcaseState.isDragging);
    updateShowcaseLightboxReadout();
  }

  function syncShowcaseLightboxViewport() {
    if (
      !showcaseLightboxCompare ||
      !showcaseState.lightboxPayload ||
      showcaseState.lightboxContentWidth <= 0 ||
      showcaseState.lightboxContentHeight <= 0
    ) {
      return;
    }
    const fitScale = Math.min(
      showcaseLightboxCompare.clientWidth / showcaseState.lightboxContentWidth,
      showcaseLightboxCompare.clientHeight / showcaseState.lightboxContentHeight
    );
    showcaseState.lightboxFitScale = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;
    showcaseState.lightboxMinZoom =
      showcaseState.lightboxFitScale > 0 ? Math.min(1, 1 / showcaseState.lightboxFitScale) : 1;
    showcaseState.lightboxZoom = clamp(showcaseState.lightboxZoom, showcaseState.lightboxMinZoom, showcaseState.lightboxMaxZoom);
    updateShowcaseLightboxTransform();
  }

  function resetShowcaseLightboxZoom() {
    showcaseState.lightboxZoom = 1;
    showcaseState.lightboxTranslateX = 0;
    showcaseState.lightboxTranslateY = 0;
    showcaseState.isDragging = false;
    showcaseState.lightboxPointerId = null;
    updateShowcaseLightboxTransform();
  }

  function setShowcaseLightboxZoom(scale, originX, originY) {
    if (!showcaseLightboxCompare || !showcaseState.lightboxPayload) {
      return;
    }
    const nextZoom = clamp(scale, showcaseState.lightboxMinZoom, showcaseState.lightboxMaxZoom);
    const previousZoom = showcaseState.lightboxZoom;
    const viewportRect = showcaseLightboxCompare.getBoundingClientRect();
    const centerX = originX ?? viewportRect.left + viewportRect.width / 2;
    const centerY = originY ?? viewportRect.top + viewportRect.height / 2;
    const localX = centerX - viewportRect.left - viewportRect.width / 2;
    const localY = centerY - viewportRect.top - viewportRect.height / 2;

    if (previousZoom !== nextZoom) {
      const zoomRatio = nextZoom / previousZoom;
      showcaseState.lightboxTranslateX = (showcaseState.lightboxTranslateX - localX) * zoomRatio + localX;
      showcaseState.lightboxTranslateY = (showcaseState.lightboxTranslateY - localY) * zoomRatio + localY;
    }

    showcaseState.lightboxZoom = nextZoom;
    if (showcaseState.lightboxZoom <= 1) {
      showcaseState.lightboxTranslateX = 0;
      showcaseState.lightboxTranslateY = 0;
    }
    updateShowcaseLightboxTransform();
  }

  function beginShowcasePan(event) {
    if (!showcaseLightboxCompare || showcaseState.lightboxZoom <= 1) {
      return;
    }
    showcaseState.isDragging = true;
    showcaseState.lightboxPointerId = event.pointerId;
    showcaseState.lightboxDragStartX = event.clientX - showcaseState.lightboxTranslateX;
    showcaseState.lightboxDragStartY = event.clientY - showcaseState.lightboxTranslateY;
    showcaseLightboxCompare.setPointerCapture?.(event.pointerId);
    updateShowcaseLightboxTransform();
  }

  function updateShowcasePan(event) {
    if (!showcaseState.isDragging || showcaseState.lightboxPointerId !== event.pointerId) {
      return;
    }
    showcaseState.lightboxTranslateX = event.clientX - showcaseState.lightboxDragStartX;
    showcaseState.lightboxTranslateY = event.clientY - showcaseState.lightboxDragStartY;
    updateShowcaseLightboxTransform();
  }

  function endShowcasePan(event) {
    if (event && showcaseState.lightboxPointerId !== null && event.pointerId !== showcaseState.lightboxPointerId) {
      return;
    }
    if (showcaseLightboxCompare && showcaseState.lightboxPointerId !== null) {
      try {
        showcaseLightboxCompare.releasePointerCapture?.(showcaseState.lightboxPointerId);
      } catch (error) {
        void error;
      }
    }
    showcaseState.isDragging = false;
    showcaseState.lightboxPointerId = null;
    updateShowcaseLightboxTransform();
  }

  function renderShowcaseLightboxBadges(payload) {
    if (!showcaseLightboxBadgeRow) {
      return;
    }
    showcaseLightboxBadgeRow.replaceChildren();
    const badges = [...(payload.badges || []), ...(payload.metrics || [])];
    badges.forEach((item) => {
      showcaseLightboxBadgeRow.appendChild(createShowcaseBadge(item));
    });
    showcaseLightboxBadgeRow.hidden = badges.length === 0;
  }

  function updateShowcaseLightboxLabels(payload) {
    const beforeStrong = showcaseLightboxBeforeLabel?.querySelector("strong");
    const afterStrong = showcaseLightboxAfterLabel?.querySelector("strong");
    if (beforeStrong) {
      beforeStrong.textContent = payload.beforeLabel || "原圖";
    }
    if (afterStrong) {
      afterStrong.textContent = payload.afterLabel || "結果";
    }
  }

  function getTopicMathSteps(mode, params) {
    if (!mode) return `<p class="math-sidebar-idle">此主題尚無分步解析。</p>`;

    switch (mode) {
      case "BC_ADJUST": {
        const b = params?.brightness ?? 0;
        const c = params?.contrast ?? 1;
        const mid = 128;
        const sR = 140, sG = 90, sB = 210;
        const s1r = sR - mid, s1g = sG - mid, s1b = sB - mid;
        const s2r = s1r * c, s2g = s1g * c, s2b = s1b * c;
        const s3r = s2r + mid + b, s3g = s2g + mid + b, s3b = s2b + mid + b;
        const oR = Math.max(0, Math.min(255, Math.round(s3r)));
        const oG = Math.max(0, Math.min(255, Math.round(s3g)));
        const oB = Math.max(0, Math.min(255, Math.round(s3b)));
        return `
<details open>
  <summary>① 減去中值：P − ${mid}</summary>
  <div>
    <div class="math-step">(${sR}−${mid}, ${sG}−${mid}, ${sB}−${mid})</div>
    <div class="math-step">= (${s1r}, ${s1g}, ${s1b})</div>
  </div>
</details>
<details>
  <summary>② 對比縮放：× ${c.toFixed(2)}</summary>
  <div>
    <div class="math-step">(${s1r}×${c.toFixed(2)}, ${s1g}×${c.toFixed(2)}, ${s1b}×${c.toFixed(2)})</div>
    <div class="math-step">= (${s2r.toFixed(1)}, ${s2g.toFixed(1)}, ${s2b.toFixed(1)})</div>
  </div>
</details>
<details>
  <summary>③ 加入亮度：+ ${mid} + ${b}</summary>
  <div>
    <div class="math-step">(${s2r.toFixed(1)}+${mid}+${b}, ${s2g.toFixed(1)}+${mid}+${b}, ${s2b.toFixed(1)}+${mid}+${b})</div>
    <div class="math-step">= (${s3r.toFixed(1)}, ${s3g.toFixed(1)}, ${s3b.toFixed(1)})</div>
  </div>
</details>
<div class="math-final">Output RGB = (${oR}, ${oG}, ${oB})</div>`;
      }

      case "BLEND": {
        const alpha = params?.alpha ?? 0.5;
        const aR = 200, aG = 100, aB = 60;
        const bR = 70, bG = 180, bB = 230;
        const w = 1 - alpha;
        const oR = Math.round(alpha * aR + w * bR);
        const oG = Math.round(alpha * aG + w * bG);
        const oB = Math.round(alpha * aB + w * bB);
        return `
<div class="math-step">混合公式：Out = α·A + (1−α)·B</div>
<div class="math-step">A = (<strong>${aR}</strong>, <strong>${aG}</strong>, <strong>${aB}</strong>)，B = (<strong>${bR}</strong>, <strong>${bG}</strong>, <strong>${bB}</strong>)</div>
<div class="math-step">α = <strong>${alpha.toFixed(2)}</strong>，權重(1−α) = <strong>${w.toFixed(2)}</strong></div>
<details>
  <summary>分步計算</summary>
  <div>
    <div class="math-step">R = <strong>${alpha.toFixed(2)}</strong>×<strong>${aR}</strong> + <strong>${w.toFixed(2)}</strong>×<strong>${bR}</strong> = <strong>${oR}</strong></div>
    <div class="math-step">G = <strong>${alpha.toFixed(2)}</strong>×<strong>${aG}</strong> + <strong>${w.toFixed(2)}</strong>×<strong>${bG}</strong> = <strong>${oG}</strong></div>
    <div class="math-step">B = <strong>${alpha.toFixed(2)}</strong>×<strong>${aB}</strong> + <strong>${w.toFixed(2)}</strong>×<strong>${bB}</strong> = <strong>${oB}</strong></div>
  </div>
</details>
<div class="math-final">Output = （<strong>${oR}</strong>, <strong>${oG}</strong>, <strong>${oB}</strong>）</div>`;
      }

      case "MOSAIC": {
        const bs = params?.blockSize ?? 10;
        const px = [[180, 95, 55], [170, 88, 50], [190, 98, 60], [165, 82, 52], [175, 90, 56]];
        const avgR = Math.round(px.reduce((s, p) => s + p[0], 0) / px.length);
        const avgG = Math.round(px.reduce((s, p) => s + p[1], 0) / px.length);
        const avgB = Math.round(px.reduce((s, p) => s + p[2], 0) / px.length);
        return `
<div class="math-step">區塊大小：<strong>${bs}×${bs}</strong></div>
<div class="math-step">取樣像素：<br>${px.map((p) => `(${p[0]}, ${p[1]}, ${p[2]})`).join("<br>")}</div>
<div class="math-step">mean(R) = ⌊(${px.map((p) => p[0]).join("+")}) ÷ ${px.length}⌋ = <strong>${avgR}</strong></div>
<div class="math-step">mean(G) = ⌊(${px.map((p) => p[1]).join("+")}) ÷ ${px.length}⌋ = <strong>${avgG}</strong></div>
<div class="math-step">mean(B) = ⌊(${px.map((p) => p[2]).join("+")}) ÷ ${px.length}⌋ = <strong>${avgB}</strong></div>
<div class="math-final">區塊填充 RGB = （<strong>${avgR}</strong>, <strong>${avgG}</strong>, <strong>${avgB}</strong>）</div>`;
      }

      case "SPATIAL": {
        const fType = params?.filterMode ?? "gaussian";
        const kSize = params?.kernelSize ?? 5;
        const descs = {
          gaussian: "以正規化高斯核加權鄰居，降低高頻雜訊。",
          sharpen: "增強中心權重，衰減周圍，銳化邊緣輪廓。",
          edge: "計算梯度突變，提取區域輪廓與紋理。"
        };
        const kernels = {
          gaussian: "1/16×[[1,2,1],[2,4,2],[1,2,1]]",
          sharpen: "[[0,−1,0],[−1,5,−1],[0,−1,0]]",
          edge: "[[−1,−1,−1],[−1,8,−1],[−1,−1,−1]]"
        };
        return `
<div class="math-step">卷積核：<strong>${kSize}×${kSize}</strong>（${fType}）</div>
<div class="math-code">${kernels[fType] ?? kernels.gaussian}</div>
<div class="math-desc">${descs[fType] ?? descs.gaussian}</div>
<details>
<summary>每像素掃描細節</summary>
<div class="math-step">I'(x,y) = Σ kernel(i,j) · I(x+i, y+j)</div>
<div class="math-step">邊界：複製最近像素 / 忽略超出範圍</div>
<div class="math-step">輸出新影像（與輸入同尺寸）</div>
</details>`;
      }

      case "FFT": {
        const fMode = params?.fftMode ?? "spectrum";
        const strength = params?.fftStrength ?? 45;
        const descs = {
          spectrum: "直接顯示頻率域能量分佈。",
          lowpass: "保留低頻，去除高頻細節與雜訊。",
          highpass: "僅保留高頻，展現邊緣與紋理。"
        };
        return `
<div class="math-step">模式：<strong>${fMode}</strong>，強度 <strong>${strength}</strong></div>
<div class="math-code">F(u,v) = Σ f(x,y)·e^(−j2π(ux/M + vy/N))</div>
<div class="math-step">① 前向 FFT：空間 → 頻率域</div>
<div class="math-step">② ${descs[fMode] ?? ""}</div>
<div class="math-step">③ 逆向 FFT：頻率 → 空間域</div>
<details>
<summary>頻率域濾波細節</summary>
<div class="math-step">低通：截止半徑內保留為 1，外為 0</div>
<div class="math-step">高通：截止半徑外保留為 1，內為 0</div>
<div class="math-step">頻譜顯示時取 log(1 + |F|)</div>
</details>`;
      }

      case "PCA": {
        const ret = params?.pcaRetention ?? 60;
        const w = params?.pcaWorkWidth ?? 64;
        const h = params?.pcaWorkHeight ?? 32;
        const orig = w * h;
        const reduced = Math.round(orig * ret / 100);
        const ratio = (orig / reduced).toFixed(1);
        return `
<div class="math-step">工作尺寸：<strong>${w}</strong>×<strong>${h}</strong> = <strong>${orig}</strong> 維</div>
<div class="math-step">保留率：<strong>${ret}%</strong> → <strong>${reduced}</strong> 維</div>
<div class="math-step">壓縮比：<strong>${ratio}:1</strong></div>
<details>
  <summary>SVD 重建公式</summary>
  <div>
    <div class="math-step">① 標準化：每像素減 mean，除 std</div>
    <div class="math-step">② 共變異矩陣：X<sup>T</sup>X / n</div>
    <div class="math-step">③ 特徵分解：取前 k 個最大特徵值向量</div>
    <div class="math-step">X ≈ U<sub>k</sub>·Σ<sub>k</sub>·V<sub>k</sub><sup>T</sup></div>
  </div>
</details>
<div class="math-final">維度降低 ${ret}%，視覺品質由保留率決定</div>`;
      }

      case "CANNY": {
        const blur = params?.cannyBlur ?? 3;
        const low = params?.cannyLow ?? 42;
        const high = params?.cannyHigh ?? 108;
        return `
<div class="math-step">① 高斯平滑：σ = <strong>${blur}</strong></div>
<div class="math-step">② Sobel 梯度：計算 Gx, Gy, 幅值</div>
<div class="math-step">③ 非極大值抑制：細化邊緣</div>
<div class="math-step">④ 雙閾值：<strong>${low}</strong> / <strong>${high}</strong></div>
<div class="math-step">⑤ 滯後追蹤：強邊緣保留，弱邊緣連至強邊緣則保留</div>
<div class="math-final">輸出：二值邊緣圖</div>
<details>
<summary>像素級推導細節</summary>
<div class="math-step">Sobel Gx: [[-1,0,1],[-2,0,2],[-1,0,1]]</div>
<div class="math-step">Sobel Gy: [[-1,-2,-1],[0,0,0],[1,2,1]]</div>
<div class="math-step">幅值 = √(Gx² + Gy²)，方向 = atan2(Gy, Gx)</div>
<div class="math-step">非極大值：僅保留梯度方向上局部最大</div>
<div class="math-step">弱邊緣：若連至強邊緣則保留，否則丟棄</div>
</details>`;
      }

      case "GRAYSCALE": {
        return `
<div class="math-step">灰階公式：Y = 0.299·R + 0.587·G + 0.114·B</div>
<div class="math-step">範例：R=<strong>160</strong>, G=<strong>80</strong>, B=<strong>50</strong></div>
<div class="math-step">= 0.299×<strong>160</strong> + 0.587×<strong>80</strong> + 0.114×<strong>50</strong></div>
<div class="math-step">= <strong>47.84</strong> + <strong>46.96</strong> + <strong>5.70</strong></div>
<div class="math-final">Output Y ≈ <strong>101</strong>（單通道）</div>`;
      }

      case "LSB": {
        return `
<div class="math-step">寫入：Pixel' = (Pixel AND 0xFE) OR bit</div>
<div class="math-step">讀出：bit = Pixel AND 1（依序重建）</div>
<div class="math-step">每像素藏 1 bit → 每 8 像素藏 1 byte</div>
<div class="math-desc">有損壓縮（JPEG）會破壞訊息。</div>`;
      }

      case "WATERMARK": {
        const alpha = params?.alpha ?? 0.3;
        return `
<div class="math-step">公式：I' = (1−α)I + α·W</div>
<div class="math-step">浮水印透明度 α = <strong>${alpha}</strong></div>
<div class="math-step">原圖像素與水印像素加權混合</div>
<div class="math-step">結果為新影像，原圖不受破壞</div>`;
      }

      default: {
        const modeLabel = mode || "未知";
        return `
<div class="math-step">操作模式：<strong>${modeLabel}</strong></div>
<div class="math-step">參數：<code>${JSON.stringify(params ?? {})}</code></div>
<div class="math-step">完整的數學推導請參考各主題卡說明。</div>`;
      }
    }
  }

  function renderShowcaseLightboxMath(payload) {
    const sidebar = showcaseLightboxMathSidebar;
    if (!sidebar) return;

    sidebar.innerHTML = "";

    const mode = payload?.mathMode;
    if (!mode) {
      sidebar.innerHTML = `<p class="math-sidebar-idle">此主題尚無分步解析。</p>`;
      return;
    }

    let params = payload.params;
    if (!params) {
      switch (mode) {
        case "BC_ADJUST":
          params = { brightness: 0, contrast: 1 };
          break;
        case "BLEND":
          params = { alpha: 0.5 };
          break;
        case "MOSAIC":
          params = { blockSize: 10 };
          break;
        case "SPATIAL":
          params = { filterMode: "gaussian", kernelSize: 5 };
          break;
        case "FFT":
          params = { fftMode: "spectrum", fftStrength: 45 };
          break;
        case "PCA":
          params = { pcaRetention: 60 };
          break;
        case "CANNY":
          params = { cannyBlur: 3, cannyLow: 42, cannyHigh: 108 };
          break;
        case "GRAYSCALE":
        case "LSB":
        case "WATERMARK":
          params = {};
          break;
        default:
          params = {};
      }
    }

    const card = document.createElement("div");
    card.className = "math-sidebar-card";
    const header = document.createElement("header");
    header.innerHTML = `<i class="material-symbols-rounded" aria-hidden="true">calculate</i> 分步解析`;
    card.appendChild(header);

    const content = document.createElement("div");
    content.className = "math-sidebar-content";
    content.innerHTML = getTopicMathSteps(mode, params);

    card.appendChild(content);
    sidebar.appendChild(card);
  }

  function clearCanvasElement(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawLightboxPaneCanvas(canvas, imageData, paneWidth, paneHeight) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }
    canvas.width = paneWidth;
    canvas.height = paneHeight;
    canvas.style.width = `${paneWidth}px`;
    canvas.style.height = `${paneHeight}px`;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, paneWidth, paneHeight);
    ctx.fillStyle = "#07101d";
    ctx.fillRect(0, 0, paneWidth, paneHeight);
    if (isUsableImageData(imageData)) {
      drawImageDataContainInRect(ctx, imageData, 0, 0, paneWidth, paneHeight);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
    ctx.fillRect(0, 0, paneWidth, paneHeight);
  }

  function renderShowcaseLightboxPanes(payload) {
    if (
      !showcaseLightboxBeforeCanvas ||
      !showcaseLightboxAfterCanvas ||
      !showcaseLightboxPaneBefore ||
      !showcaseLightboxPaneAfter ||
      !showcaseLightboxSplit ||
      !showcaseLightboxZoomLayer
    ) {
      return;
    }

    const paneWidth = Math.max(1, payload.beforeImageData?.width || 0, payload.afterImageData?.width || 0, payload.width || 960);
    const paneHeight = Math.max(1, payload.beforeImageData?.height || 0, payload.afterImageData?.height || 0, payload.height || 640);
    const paneGap = Math.max(18, Math.round(Math.min(paneWidth, paneHeight) * 0.035));

    showcaseState.lightboxContentWidth = paneWidth * 2 + paneGap;
    showcaseState.lightboxContentHeight = paneHeight;

    showcaseLightboxSplit.style.setProperty("--showcase-lightbox-pane-gap", `${paneGap}px`);
    showcaseLightboxZoomLayer.style.width = `${showcaseState.lightboxContentWidth}px`;
    showcaseLightboxZoomLayer.style.height = `${showcaseState.lightboxContentHeight}px`;

    [showcaseLightboxPaneBefore, showcaseLightboxPaneAfter].forEach((pane) => {
      pane.style.width = `${paneWidth}px`;
      pane.style.height = `${paneHeight}px`;
    });

    drawLightboxPaneCanvas(showcaseLightboxBeforeCanvas, payload.beforeImageData, paneWidth, paneHeight);
    drawLightboxPaneCanvas(showcaseLightboxAfterCanvas, payload.afterImageData, paneWidth, paneHeight);
  }

  function openShowcaseLightbox(payload, trigger) {
    if (!showcaseLightbox || !showcaseLightboxTitle || !payload || !showcaseLightboxBeforeCanvas || !showcaseLightboxAfterCanvas) {
      return;
    }
    showcaseState.activeLightboxTrigger = trigger || null;
    showcaseState.lightboxPayload = payload;
    showcaseLightboxTitle.textContent = payload.title || "展示案例";
    if (showcaseLightboxDescription) {
      showcaseLightboxDescription.textContent = payload.description || payload.caption || "保留同框前後對比，方便查看細節變化。";
    }
    renderShowcaseLightboxPanes(payload);
    updateShowcaseLightboxLabels(payload);
    renderShowcaseLightboxBadges(payload);
    renderShowcaseLightboxMath(payload);
    showcaseLightbox.hidden = false;
    showcaseLightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("showcase-lightbox-open");
    resetShowcaseLightboxZoom();
    requestAnimationFrame(() => {
      showcaseLightbox.classList.add("is-visible");
      syncShowcaseLightboxViewport();
      window.dispatchEvent(new Event("resize"));
      showcaseLightboxClose?.focus();
    });
  }

  function openShowcaseLightboxFromCanvas(canvas) {
    const previewLabel = canvas.dataset.previewLabel || canvas.getAttribute("aria-label") || "展示預覽";
    const fallbackImageData = canvasElementToImageData(canvas);
    const payload =
      canvas.__showcaseLightboxPayload && typeof canvas.__showcaseLightboxPayload === "object"
        ? canvas.__showcaseLightboxPayload
        : {
            title: previewLabel,
            description: "同框前後對比展示",
            beforeLabel: "原圖",
            afterLabel: "結果",
            beforeImageData: fallbackImageData,
            afterImageData: fallbackImageData,
            width: canvas.width || 960,
            height: canvas.height || 640
          };
    openShowcaseLightbox(payload, canvas);
  }

  function closeShowcaseLightbox() {
    if (!showcaseLightbox || showcaseLightbox.hidden) {
      return;
    }
    endShowcasePan();
    resetShowcaseLightboxZoom();
    showcaseLightbox.classList.remove("is-visible");
    showcaseLightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("showcase-lightbox-open");
    window.setTimeout(() => {
      if (showcaseLightbox.getAttribute("aria-hidden") === "true") {
        showcaseLightbox.hidden = true;
        showcaseState.lightboxPayload = null;
        showcaseState.lightboxContentWidth = 0;
        showcaseState.lightboxContentHeight = 0;
        clearCanvasElement(showcaseLightboxBeforeCanvas);
        clearCanvasElement(showcaseLightboxAfterCanvas);
        showcaseLightboxZoomLayer?.style.removeProperty("width");
        showcaseLightboxZoomLayer?.style.removeProperty("height");
        showcaseLightboxSplit?.style.removeProperty("--showcase-lightbox-pane-gap");
        showcaseLightboxPaneBefore?.style.removeProperty("width");
        showcaseLightboxPaneBefore?.style.removeProperty("height");
        showcaseLightboxPaneAfter?.style.removeProperty("width");
        showcaseLightboxPaneAfter?.style.removeProperty("height");
        if (showcaseLightboxBadgeRow) {
          showcaseLightboxBadgeRow.replaceChildren();
          showcaseLightboxBadgeRow.hidden = true;
        }
      }
    }, 180);
    if (showcaseState.activeLightboxTrigger?.isConnected) {
      showcaseState.activeLightboxTrigger.focus();
    }
    showcaseState.activeLightboxTrigger = null;
  }

  function buildSummaryGrid(cards) {
    const grid = document.createElement("div");
    grid.className = "showcase-summary-grid";
    cards.forEach((item) => {
      const card = document.createElement("article");
      card.className = "showcase-summary-card";
      if (item.label) {
        const label = document.createElement("p");
        label.className = "showcase-summary-card__label";
        label.textContent = item.label;
        card.appendChild(label);
      }
      const title = document.createElement("h4");
      title.textContent = item.title;
      const description = document.createElement("p");
      description.textContent = item.description;
      card.appendChild(title);
      card.appendChild(description);
      grid.appendChild(card);
    });
    return grid;
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
    ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
    ctx.arcTo(x, y + height, x, y, safeRadius);
    ctx.arcTo(x, y, x + width, y, safeRadius);
    ctx.closePath();
  }

  function drawImageDataCover(ctx, imageData, targetWidth, targetHeight) {
    const sourceCtx = createCanvasContext(imageData.width, imageData.height, { willReadFrequently: true });
    sourceCtx.putImageData(imageData, 0, 0);
    const scale = Math.max(targetWidth / imageData.width, targetHeight / imageData.height);
    const drawWidth = imageData.width * scale;
    const drawHeight = imageData.height * scale;
    const offsetX = (targetWidth - drawWidth) / 2;
    const offsetY = (targetHeight - drawHeight) / 2;
    ctx.drawImage(sourceCtx.canvas, offsetX, offsetY, drawWidth, drawHeight);
    sourceCtx.canvas.width = 0;
    sourceCtx.canvas.height = 0;
  }

  function drawImageDataContainInRect(ctx, imageData, x, y, width, height) {
    const sourceCtx = createCanvasContext(imageData.width, imageData.height, { willReadFrequently: true });
    sourceCtx.putImageData(imageData, 0, 0);
    const scale = Math.min(width / imageData.width, height / imageData.height);
    const drawWidth = imageData.width * scale;
    const drawHeight = imageData.height * scale;
    const offsetX = x + (width - drawWidth) / 2;
    const offsetY = y + (height - drawHeight) / 2;
    ctx.drawImage(sourceCtx.canvas, offsetX, offsetY, drawWidth, drawHeight);
    sourceCtx.canvas.width = 0;
    sourceCtx.canvas.height = 0;
  }

  function drawCompareToCanvas(canvas, beforeImageData, afterImageData) {
    const fallbackWidth = beforeImageData?.width || afterImageData?.width || 960;
    const fallbackHeight = beforeImageData?.height || afterImageData?.height || 640;
    canvas.width = fallbackWidth;
    canvas.height = fallbackHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const framePadding = Math.max(24, Math.round(canvas.width / 34));
    const gutter = Math.max(18, Math.round(canvas.width / 48));
    const innerHeight = canvas.height - framePadding * 2;
    const paneWidth = (canvas.width - framePadding * 2 - gutter) / 2;
    const leftX = framePadding;
    const rightX = leftX + paneWidth + gutter;
    const paneY = framePadding;
    const paneRadius = Math.max(24, Math.round(canvas.width / 34));
    const dividerCenterX = canvas.width / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#050a14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    [
      { x: leftX, tint: "rgba(82, 230, 255, 0.12)", shadow: "rgba(74, 210, 255, 0.18)" },
      { x: rightX, tint: "rgba(255, 189, 129, 0.1)", shadow: "rgba(255, 208, 164, 0.16)" }
    ].forEach((pane, index) => {
      const imageData = index === 0 ? beforeImageData : afterImageData;
      ctx.save();
      drawRoundedRect(ctx, pane.x, paneY, paneWidth, innerHeight, paneRadius);
      ctx.clip();
      ctx.fillStyle = "rgba(7, 14, 32, 0.54)";
      ctx.fillRect(pane.x, paneY, paneWidth, innerHeight);
      if (isUsableImageData(imageData)) {
        drawImageDataContainInRect(ctx, imageData, pane.x, paneY, paneWidth, innerHeight);
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(232, 244, 255, 0.34)";
      ctx.lineWidth = Math.max(2, canvas.width / 480);
      ctx.shadowBlur = Math.max(14, canvas.width / 80);
      ctx.shadowColor = pane.shadow;
      drawRoundedRect(ctx, pane.x, paneY, paneWidth, innerHeight, paneRadius);
      ctx.stroke();
      ctx.restore();
    });

    const stageStroke = Math.max(2.5, canvas.width / 420);
    ctx.save();
    ctx.strokeStyle = "rgba(236, 245, 255, 0.2)";
    ctx.lineWidth = stageStroke;
    drawRoundedRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, Math.max(18, canvas.width / 36));
    ctx.stroke();
    ctx.restore();

    ctx.save();
    const dividerGlow = ctx.createLinearGradient(dividerCenterX, framePadding, dividerCenterX, framePadding + innerHeight);
    dividerGlow.addColorStop(0, "rgba(255, 255, 255, 0)");
    dividerGlow.addColorStop(0.15, "rgba(210, 243, 255, 0.9)");
    dividerGlow.addColorStop(0.5, "rgba(125, 231, 255, 1)");
    dividerGlow.addColorStop(0.85, "rgba(255, 198, 146, 0.86)");
    dividerGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.strokeStyle = dividerGlow;
    ctx.lineWidth = Math.max(4, canvas.width / 220);
    ctx.shadowBlur = Math.max(18, canvas.width / 48);
    ctx.shadowColor = "rgba(115, 228, 255, 0.42)";
    ctx.beginPath();
    ctx.moveTo(dividerCenterX, framePadding + 14);
    ctx.lineTo(dividerCenterX, canvas.height - framePadding - 14);
    ctx.stroke();
    ctx.restore();

    const handleWidth = Math.max(26, canvas.width / 34);
    const handleHeight = Math.max(86, canvas.height / 7.6);
    const handleX = dividerCenterX - handleWidth / 2;
    const handleY = canvas.height / 2 - handleHeight / 2;
    ctx.save();
    drawRoundedRect(ctx, handleX, handleY, handleWidth, handleHeight, handleWidth / 2);
    ctx.fillStyle = "rgba(9, 18, 42, 0.78)";
    ctx.fill();
    ctx.strokeStyle = "rgba(234, 245, 255, 0.38)";
    ctx.lineWidth = Math.max(2, canvas.width / 480);
    ctx.stroke();
    ctx.restore();

    const notchGap = handleHeight / 6;
    ctx.save();
    ctx.strokeStyle = "rgba(235, 246, 255, 0.84)";
    ctx.lineWidth = Math.max(2, canvas.width / 520);
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i += 1) {
      const y = canvas.height / 2 + i * notchGap;
      ctx.beginPath();
      ctx.moveTo(dividerCenterX - handleWidth / 5, y);
      ctx.lineTo(dividerCenterX + handleWidth / 5, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function createCompareLabel(type, text, className) {
    const tag = document.createElement("span");
    tag.className = `showcase-compare__label ${className}`;
    const kicker = document.createElement("small");
    kicker.textContent = type;
    const strong = document.createElement("strong");
    strong.textContent = text;
    tag.appendChild(kicker);
    tag.appendChild(strong);
    return tag;
  }

  function buildCompareFrame(sample, model) {
    const figure = document.createElement("figure");
    figure.className = "showcase-compare";

    if (sample.badges?.length) {
      const specs = buildBadgeRow(sample.badges, "showcase-compare__specs showcase-badge-row");
      figure.appendChild(specs);
    }

    const canvas = document.createElement("canvas");
    const beforeLabel = sample.beforeLabel || "原圖";
    const afterLabel = sample.afterLabel || "結果";
    canvas.setAttribute("aria-label", `${sample.title}前後對比`);
    drawCompareToCanvas(canvas, sample.beforeImageData, sample.afterImageData);
    decoratePreviewCanvas(canvas, `${sample.title}放大檢視`, true, {
      title: sample.title,
      description: sample.description,
      caption: sample.compareCaption || sample.note || "",
      badges: sample.badges || [],
      metrics: sample.metrics || [],
      beforeLabel,
      afterLabel,
      beforeImageData: sample.beforeImageData,
      afterImageData: sample.afterImageData,
      mathMode: sample.mathMode || model?.mathMode || null,
      params: sample.params || model?.params || null,
      width: canvas.width,
      height: canvas.height
    });

    const divider = document.createElement("span");
    divider.className = "showcase-compare__divider";
    const dividerLine = document.createElement("span");
    dividerLine.className = "showcase-compare__divider-line";
    const dividerGlass = document.createElement("span");
    dividerGlass.className = "showcase-compare__divider-glass";
    divider.appendChild(dividerLine);
    divider.appendChild(dividerGlass);

    const caption = document.createElement("figcaption");
    caption.className = "showcase-compare__caption";
    caption.textContent = sample.compareCaption || "同框保留固定前後對比，點擊後可用大視窗放大觀察細節差異。";

    figure.appendChild(canvas);
    figure.appendChild(createCompareLabel("BEFORE", beforeLabel, "showcase-compare__before"));
    figure.appendChild(createCompareLabel("AFTER", afterLabel, "showcase-compare__after"));
    figure.appendChild(divider);
    figure.appendChild(caption);
    return figure;
  }

  function buildShowcaseTopicView(model) {
    const fragment = document.createDocumentFragment();
    const head = document.createElement("div");
    head.className = "showcase-panel-head";
    const headCopy = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "showcase-panel-head__eyebrow";
    eyebrow.textContent = "教學展示主題";
    const title = document.createElement("h3");
    title.textContent = model.title;
    const subtitle = document.createElement("p");
    subtitle.className = "showcase-topic-subtitle";
    subtitle.textContent = model.subtitle;
    const description = document.createElement("p");
    description.className = "showcase-panel-head__description";
    description.textContent = model.description;
    headCopy.appendChild(eyebrow);
    headCopy.appendChild(title);
    headCopy.appendChild(subtitle);
    headCopy.appendChild(description);
    head.appendChild(headCopy);
    fragment.appendChild(head);
    if (model.headlineBadges?.length) {
      fragment.appendChild(buildBadgeRow(model.headlineBadges));
    }

    const formulaBox = document.createElement("section");
    formulaBox.className = "showcase-formula";
    const formulaLabel = document.createElement("span");
    formulaLabel.className = "showcase-formula__label";
    formulaLabel.textContent = model.formula.label || "核心公式";
    const formulaText = document.createElement("code");
    formulaText.innerHTML = model.formula.expression;
    const formulaHint = document.createElement("p");
    formulaHint.className = "showcase-formula__hint";
    formulaHint.textContent = model.formula.hint;
    formulaBox.appendChild(formulaLabel);
    formulaBox.appendChild(formulaText);
    formulaBox.appendChild(formulaHint);
    fragment.appendChild(formulaBox);
    
    // 使用 ensureMathJaxReady 確保 MathJax 完全載入
    ensureMathJaxReady(function() {
      window.MathJax.typesetPromise([formulaBox]).catch(function(err) {
        console.log('MathJax typeset error:', err);
      });
    });

    if (model.summaryCards?.length) {
      fragment.appendChild(buildSummaryGrid(model.summaryCards));
    }

    const samplesGrid = document.createElement("div");
    samplesGrid.className = "showcase-grid showcase-grid--samples";
    model.samples.forEach((sample) => {
      const card = document.createElement("article");
      card.className = "showcase-sample";
      const sampleHead = document.createElement("div");
      sampleHead.className = "showcase-sample__head";
      const copy = document.createElement("div");
      const sampleTitle = document.createElement("h4");
      sampleTitle.textContent = sample.title;
      const sampleDescription = document.createElement("p");
      sampleDescription.textContent = sample.description;
      copy.appendChild(sampleTitle);
      copy.appendChild(sampleDescription);
      sampleHead.appendChild(copy);
      card.appendChild(sampleHead);
      card.appendChild(buildCompareFrame(sample, model));
      if (sample.metrics?.length) {
        card.appendChild(buildBadgeRow(sample.metrics, "showcase-metric-row showcase-badge-row"));
      }
      if (sample.note) {
        const note = document.createElement("p");
        note.className = "showcase-sample__note";
        note.textContent = sample.note;
        card.appendChild(note);
      }
      samplesGrid.appendChild(card);
    });
    fragment.appendChild(samplesGrid);

    if (model.exercise) {
      const exerciseSection = document.createElement("section");
      exerciseSection.className = "showcase-exercise";
      const exerciseLabel = document.createElement("span");
      exerciseLabel.className = "showcase-exercise__label";
      exerciseLabel.textContent = "小練習";
      const exerciseQuestion = document.createElement("p");
      exerciseQuestion.className = "showcase-exercise__question";
      exerciseQuestion.textContent = model.exercise.question;
      const exerciseAnswer = document.createElement("details");
      exerciseAnswer.className = "showcase-exercise__answer";
      const answerSummary = document.createElement("summary");
      answerSummary.textContent = "查看解答";
      const answerText = document.createElement("p");
      answerText.textContent = model.exercise.answer;
      exerciseAnswer.appendChild(answerSummary);
      exerciseAnswer.appendChild(answerText);
      exerciseSection.appendChild(exerciseLabel);
      exerciseSection.appendChild(exerciseQuestion);
      exerciseSection.appendChild(exerciseAnswer);
      fragment.appendChild(exerciseSection);
    }

    return fragment;
  }

  function updateActiveTopicButtons() {
    topicButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.showcaseTopic === showcaseState.topic);
    });
  }

  function makeSummaryCard(label, title, description) {
    return { label, title, description };
  }

  function makeSample(config) {
    return config;
  }

  async function renderShowcaseBrightnessContrast() {
    const source = showcaseState.imageAData;
    return {
      title: "亮度與對比",
      subtitle: "用固定 b / c 參數展示明暗與層次變化",
      description: "亮度就是整體加減光，對比是把亮的地方更亮、暗的地方更暗。就像用手機濾鏡調『明亮度』和『鮮豔度』，常用在修圖、醫學影像讓細節更清楚、夜拍照片救回亮度、老照片翻新。",
      mathMode: "BC_ADJUST",
      params: { brightness: -36, contrast: 0.82 },
      formula: {
        label: "核心公式",
        expression: "$I'(x,y) = (I(x,y) - 128) \\cdot \\alpha + 128 + \\beta$",
        hint: "α 控制對比（倍率），β 控制亮度（偏移）；調整時要特別注意高亮區是否逼近 255 而過曝。"
      },
      headlineBadges: ["固定案例", "同框前後對比", "顯示參數", "亮度 b / 對比 c"],
      summaryCards: [
        makeSummaryCard("觀念提醒", "亮度是整體加減光", "亮度往右拉，整張圖一起變亮；往左拉則一起變暗，是最直覺的調整方向。"),
        makeSummaryCard("觀念提醒", "對比是亮暗拉開", "對比提高後，亮的更亮、暗的更暗，輪廓邊緣會變得更清楚。"),
        makeSummaryCard("常用場景", "夜拍救回、老照翻新、醫學增強", "只要把本來太暗的圖整體拉亮，再微調對比讓細節浮現出來。")
      ],
      samples: [
        makeSample({
          title: "柔化壓低",
          description: "你看這張圖，本來有點亮對不對？我們把『亮度』往左拉 -36，圖就變暗了。再把『對比』降到 0.82，亮暗差距收窄，畫面變得柔和安靜。",
          badges: ["亮度 -36", "對比 0.82"],
          beforeImageData: source,
          afterImageData: applyBrightnessContrast(source, -36, 0.82),
          beforeLabel: "原圖",
          afterLabel: "柔化後",
          mathMode: "BC_ADJUST",
          params: { brightness: -36, contrast: 0.82 },
          metrics: ["固定案例", "適合觀察亮部收斂"],
          note: "天空與山體的亮暗差距會收窄，畫面更安靜柔和。"
        }),
        makeSample({
          title: "基準對照",
          description: "保留原始亮度與對比，當作所有案例的中性參考點。",
          badges: ["亮度 0", "對比 1.00"],
          beforeImageData: source,
          afterImageData: applyBrightnessContrast(source, 0, 1),
          beforeLabel: "原圖",
          afterLabel: "基準",
          mathMode: "BC_ADJUST",
          params: { brightness: 0, contrast: 1 },
          metrics: ["無額外偏移", "最適合當比較基準"],
          note: "這組用來確認後續案例到底改變了多少，而不是單看一張處理後結果。"
        }),
        makeSample({
          title: "提亮增強",
          description: "同時提亮並拉高對比，讓山脊與雲層的分界更集中。",
          badges: ["亮度 32", "對比 1.28"],
          beforeImageData: source,
          afterImageData: applyBrightnessContrast(source, 32, 1.28),
          beforeLabel: "原圖",
          afterLabel: "提亮後",
          mathMode: "BC_ADJUST",
          params: { brightness: 32, contrast: 1.28 },
          metrics: ["亮暗差更明顯", "高光需留意過曝"],
          note: "對比拉高後輪廓更有力，但高亮區也更容易逼近飽和。"
        })
      ],
      exercise: {
        question: "小練習：如果你要把一張晚上拍的照片變得像白天，你會先調亮度還是先調對比？為什麼？",
        answer: "先調亮度。因為對比是拉開差距，如果亮度不足，調對比只是在暗的基礎上拉開差距，整體還是暗的。先把整體亮度提高，再看情況微調對比，才能真正模擬白天的視覺效果。"
      }
    };
  }

  async function renderShowcaseBlend() {
    const imageA = showcaseState.imageAData;
    const imageB = showcaseState.imageBData;
    return {
      title: "雙圖混合",
      subtitle: "雙圖權重混合的固定案例展示",
      description: "雙圖混合會用 alpha 在兩張影像之間做權重分配，讓原圖結構與輔助風格層同時出現在輸出畫面中。",
      mathMode: "BLEND",
      params: { alpha: 0.5 },
      formula: {
        label: "核心公式",
        expression: "$\\text{Out} = \\alpha A + (1 - \\alpha)B$",
        hint: "α 越高越接近 A 圖，越低則越偏向 B 圖；這裡的 B 圖是展示頁專用的風格輔助圖層。"
      },
      headlineBadges: ["固定案例", "同框前後對比", "顯示參數", "α 權重"],
      summaryCards: [
        makeSummaryCard("混合策略", "A 圖保留主結構", "所有案例都以原圖當主結構，方便在同一基準上觀察權重差異。"),
        makeSummaryCard("混合策略", "B 圖提供風格層", "B 圖加入冷暖色洗染與斜向線條，讓混合效果更容易被看出來。")
      ],
      samples: [
        makeSample({
          title: "風格圖 B 長怎樣？",
          description: "在開始混合之前，我們先來看看 B 圖本尊。這張圖是我們剛才載入的 KY.png，接下來的案例都會用它來和原圖進行疊加。",
          badges: ["α = 0.00", "B 圖占比 100%"],
          beforeImageData: imageA,
          afterImageData: imageB,
          beforeLabel: "原圖 A",
          afterLabel: "B 圖 (KY.png)",
          mathMode: "BLEND",
          params: { alpha: 0 },
          metrics: ["純看 B 圖", "確認 B 圖內容"],
          note: "這組用來先確認 B 圖本身長什麼樣子，再觀察它和原圖混合後的差異。"
        }),
        makeSample({
          title: "風格輕覆蓋",
          description: "少量加入風格輔助圖層，讓原圖仍是主角。",
          badges: ["α = 0.75", "B 圖占比 25%"],
          beforeImageData: imageA,
          afterImageData: blendTwoImages(imageA, imageB, 0.75),
          beforeLabel: "原圖 A",
          afterLabel: "混合輸出",
          mathMode: "BLEND",
          params: { alpha: 0.75 },
          metrics: ["原圖結構占優", "色調變化較溫和"],
          note: "如果想保留可辨識內容，又想補上一層風格化氣氛，這組會最直觀。"
        }),
        makeSample({
          title: "均衡混合",
          description: "兩邊權重接近平均，最容易看見兩張圖同時存在。",
          badges: ["α = 0.50", "B 圖占比 50%"],
          beforeImageData: imageA,
          afterImageData: blendTwoImages(imageA, imageB, 0.5),
          beforeLabel: "原圖 A",
          afterLabel: "混合輸出",
          mathMode: "BLEND",
          params: { alpha: 0.5 },
          metrics: ["雙層資訊並列", "色彩差異最明顯"],
          note: "這組非常適合教學，因為原圖細節與額外風格都清楚保留下來。"
        }),
        makeSample({
          title: "風格主導",
          description: "提高 B 圖權重，輸出更明顯往輔助風格層靠攏。",
          badges: ["α = 0.25", "B 圖占比 75%"],
          beforeImageData: imageA,
          afterImageData: blendTwoImages(imageA, imageB, 0.25),
          beforeLabel: "原圖 A",
          afterLabel: "混合輸出",
          mathMode: "BLEND",
          params: { alpha: 0.25 },
          metrics: ["風格層更強", "線條與冷色更突出"],
          note: "當 alpha 降低時，視覺語氣會更偏向 B 圖，而不是單純的亮度改動。"
        })
      ]
    };
  }

  async function renderShowcaseLSB() {
    const source = showcaseState.imageAData;
    const secretMessage = "Image Processing Wizard";
    const encodedImageData = encodeLSB(source, secretMessage);
    const destroyedImageData = applyLSBDestroy(encodedImageData);
    const decodedMessage = decodeLSB(encodedImageData);
    return {
      title: "LSB 隱寫術",
      subtitle: "在像素裡藏『秘密小紙條』的固定案例展示",
      description: "LSB 隱寫術就是在像素裡藏『秘密小紙條』。我們偷偷把像素數字的最後一位改掉，人眼看不出來，但電腦讀得出來。常用在：數位浮水印、版權保護、情報傳遞。",
      mathMode: "LSB",
      params: {},
      formula: {
        label: "核心公式",
        expression: "$P'_{\\text{LSB}} = (P \\; \\text{AND} \\; 254) \\; \\text{OR} \\; S$",
        hint: "這叫『最低有效位』法。每個像素的數字是 0 到 255，我把 255 變成 254，你根本分不出來。但我們把這些 0 和 1 的變化收集起來，就能組成一段文字。"
      },
      headlineBadges: ["固定案例", "同框前後對比", "顯示參數", "隱寫 / 解讀"],
      summaryCards: [
        makeSummaryCard("核心原理", "LSB = 最低有效位", "像素值的最後一個二進位 bit 改掉 0 或 1，人眼完全察覺不到，但電腦讀得出來——這就是『隱寫術』。"),
        makeSummaryCard("視覺效果", "原圖 vs 藏訊息後 vs 破壞後", "原圖和藏了秘密的圖，看起來完全一模一樣。只有用專門的解讀工具，才能把秘密取出來。"),
        makeSummaryCard("安全提醒", "模糊、壓縮都會破壞秘密", "只要對圖片做有損處理（模糊、壓縮、截圖），那些最低位就會被改掉，秘密就消失了！")
      ],
      samples: [
        makeSample({
          title: "原圖",
          description: "這是一張正常的照片，看起來沒有任何異常。但我們即將在它的像素裡藏入一個秘密訊息。",
          badges: ["原始影像"],
          beforeImageData: source,
          afterImageData: source,
          beforeLabel: "原圖",
          afterLabel: "原圖",
          metrics: ["正常影像", "未處理"],
          note: "這是基準原圖，用來對比藏入秘密後的視覺差異（肉眼幾乎看不出來）。"
        }),
        makeSample({
          title: "藏入秘密",
          description: "我們把訊息『Image Processing Wizard』藏進了像素的最後一個 bit。看起來和原圖一模一樣對不對？但電腦可以讀出來：",
          badges: ["已隱藏訊息", "『Image Processing Wizard』"],
          beforeImageData: source,
          afterImageData: encodedImageData,
          beforeLabel: "原圖",
          afterLabel: "已藏入秘密",
          metrics: ["視覺差異 ≈ 0", `解讀結果：${decodedMessage}`],
          note: "255 變成 254、或者 0 變成 1——顏色的微小變化，人眼根本分不出來這張圖被動過手腳。"
        }),
        makeSample({
          title: "秘密被破壞",
          description: "對這張圖執行『強烈模糊』處理。你看起來和原圖很像對不對？但是！那些藏著秘密的 bit 全部被平均掉了——秘密消失了！",
          badges: ["已執行模糊破壞", "秘密無法解讀"],
          beforeImageData: encodedImageData,
          afterImageData: destroyedImageData,
          beforeLabel: "藏了秘密的圖",
          afterLabel: "模糊後",
          metrics: ["秘密被破壞", "資訊已流失"],
          note: "平均色的計算會把那些 LSB 全部混合，秘密訊息就再也無法還原了。"
        })
      ],
      exercise: {
        question: "小練習：如果我對這張藏了秘密的照片進行『強烈模糊』處理，秘密還會存在嗎？為什麼？",
        answer: "秘密會消失。強烈模糊（平均化）會把整個區域內的所有像素混合成一個平均色，這些平均色是由大量像素的 LSB 共同決定的。原本藏在 LSB 裡的 0 和 1 被平均掉後，就再也無法還原成原始的訊息了——這就是有損處理對隱寫術的致命影響。"
      }
    };
  }

  async function renderShowcaseMosaic() {
    const source = showcaseState.imageAData;
    return {
      title: "馬賽克與像素化",
      subtitle: "區塊平均色塊的固定案例展示",
      description: "馬賽克就是讓像素『集體行動』。把一小區的人通通變成同一種顏色，讓細節消失。常用在：保護隱私（人臉、車牌）、像素藝術風格設計 (Pixel Art)。",
      mathMode: "MOSAIC",
      params: { blockSize: 10 },
      formula: {
        label: "核心公式",
        expression: "$\\text{Color}_{\\text{block}} = \\frac{1}{N^2} \\sum_{i,j} P(i,j)$",
        hint: "這個動作其實是『資訊流失』。我們把 10×10 的區域強行變成一個平均色。如果你回到首頁使用『探針』工具，就會發現馬賽克區域的 3×3 矩陣數字通通都變成一模一樣了！"
      },
      headlineBadges: ["固定案例", "同框前後對比", "顯示參數", "區塊大小"],
      summaryCards: [
        makeSummaryCard("核心動作", "馬賽克 = 集體行動", "把一個區域內的所有像素強行變成同一個顏色。區塊越大，『集體』越大，細節消失得越多。"),
        makeSummaryCard("資訊原理", "馬賽克是一種不可逆的資訊流失", "把 100 個數字平均成 1 個數字之後，原本那 100 個數字就再也回不來了。這就是為什麼馬賽克不能『逆轉』。"),
        makeSummaryCard("實用場景", "隱私保護、Pixel Art、影像簡化", "打馬賽克是為了遮住車牌和臉；Pixel Art 是故意用這種『不精確』來做藝術風格。")
      ],
      samples: [
        makeSample({
          title: "細緻像素化",
          description: "區塊仍然小，畫面結構還算完整，但邊緣已經開始方塊化了。如果你回到首頁使用『探針』工具，就會發現馬賽克區域的 3×3 矩陣數字通通都變成一模一樣了！",
          badges: ["區塊大小 6"],
          beforeImageData: source,
          afterImageData: applyPixelation(source, 6),
          beforeLabel: "原圖",
          afterLabel: "馬賽克",
          mathMode: "MOSAIC",
          params: { blockSize: 6 },
          metrics: ["辨識度高", "紋理開始方塊化"],
          note: "適合教學示範像素化剛開始出現時的視覺變化。"
        }),
        makeSample({
          title: "中度簡化",
          description: "區塊變大後，細節明顯流失，但主體輪廓仍可辨識。你仔細看——天空和山都還在輪廓，但那些細節的『數字』已經全部被平均掉、消失不見了。",
          badges: ["區塊大小 14"],
          beforeImageData: source,
          afterImageData: applyPixelation(source, 14),
          beforeLabel: "原圖",
          afterLabel: "馬賽克",
          mathMode: "MOSAIC",
          params: { blockSize: 14 },
          metrics: ["辨識度中等", "色塊感變強"],
          note: "山體與天空仍看得出來，但局部紋理已經轉為大色塊。"
        }),
        makeSample({
          title: "高度抽象",
          description: "大區塊平均後，影像更像色塊拼貼而非照片。這時候大部分細節都已經『蒸發』了，只剩下大色塊在撐場面。",
          badges: ["區塊大小 26"],
          beforeImageData: source,
          afterImageData: applyPixelation(source, 26),
          beforeLabel: "原圖",
          afterLabel: "馬賽克",
          mathMode: "MOSAIC",
          params: { blockSize: 26 },
          metrics: ["辨識度低", "最適合觀察資訊壓縮感"],
          note: "這組案例最能看出區塊大小對視覺抽象程度的影響。"
        })
      ],
      exercise: {
        question: "小練習：馬賽克之後的照片，有辦法用數學公式『完美逆轉』回原圖嗎？消失的數字去哪了？",
        answer: "無法完美逆轉。馬賽克把 100 個數字平均成 1 個數字時，原本的 100 個數字已經『混合在一起』了，平均值只能代表這 100 個數字的『總體感覺』，無法還原每個數字原本是多少。那些數字並沒有『去到哪裡』——它們只是被混合、被平均，從此再也分不開了。這就是『不可逆的有損操作』。"
      }
    };
  }

  async function renderShowcaseFFT() {
    const source = showcaseState.imageAData;
    try {
      const cache = await ensureShowcaseFFTCache(source);

      // 使用 Worker 並行計算 FFT 結果
      const spectrumResult = await runShowcaseFFT(cache.grayBuffer, cache.width, cache.height, "spectrum", 50);
      const lowpassResult  = await runShowcaseFFT(cache.grayBuffer, cache.width, cache.height, "lowpass",  35);
      const highpassResult = await runShowcaseFFT(cache.grayBuffer, cache.width, cache.height, "highpass", 65);

      return {
        title: "FFT 頻率域處理",
        subtitle: "頻域觀察與濾波的固定案例展示",
        description: "FFT 就是把照片拆開成無數種『波浪紋路』。細碎的波代表細節，寬大的波代表輪廓。就像把音樂拆成高音和低音一樣。常用在：消除老照片的網點紋路、壓縮照片大小、WiFi 訊號傳輸。",
        mathMode: "FFT",
        params: { fftMode: "lowpass", fftStrength: 35 },
        formula: {
          label: "核心公式",
          expression: "$F(u,v) = \\sum_{x,y} f(x,y)\\, e^{-j2\\pi(\\frac{ux}{M} + \\frac{vy}{N})}$",
          hint: "中間發亮的頻譜圖中心代表輪廓（低頻），外圍代表細節（高頻）。用低通濾波把外面擦掉，照片就只剩下大形狀，雜訊就消失了！"
        },
        headlineBadges: ["固定案例", "同框前後對比", "顯示參數", "模式 / 強度"],
        summaryCards: [
          makeSummaryCard("頻域概念", "頻譜圖：把照片翻譯成波浪", "頻譜圖把影像的能量翻譯成亮度分布，中間亮 = 整體大形狀，外圍亮 = 細節多。"),
          makeSummaryCard("濾波原理", "低通：只留大波浪 | 高通：只留小波紋", "低通保留外圍擦掉，畫面就只剩下大形狀；高通只留外圍，輪廓線就蹦出來了。"),
          makeSummaryCard("數學魔力", "正向 FFT → 頻域濾波 → 反向 FFT", "這整個流程就是：用數學把圖翻譯成波，擦掉不要的頻率，再翻譯回來。")
        ],
        samples: [
          makeSample({
            title: "頻譜視圖",
            description: "我們先點『正向 FFT』，中間發亮的頻譜圖中心代表輪廓，外圍代表細節。你看，中間是不是最亮？那就是這張圖的『大局』所在！",
            badges: ["模式：頻譜圖", "強度：50"],
            mathMode: "FFT",
            params: { fftMode: "spectrum", fftStrength: 50 },
            beforeImageData: source,
            afterImageData: buildShowcaseFFTResult(cache, "spectrum", 50, spectrumResult),
            beforeLabel: "原圖",
            afterLabel: "頻譜圖",
            metrics: ["觀察低頻中心", "適合說明頻域概念"],
            note: "這張不是直接的照片效果，而是把頻率能量轉成可視化圖像。"
          }),
          makeSample({
            title: "低通濾波",
            description: "當我們用『低通濾波』把外面擦掉，照片就只剩下大形狀，雜訊就消失了！這就是數學的魔力。你看，山的輪廓現在是不是超清楚？",
            badges: ["模式：低通濾波", "強度：35"],
            mathMode: "FFT",
            params: { fftMode: "lowpass", fftStrength: 35 },
            beforeImageData: source,
            afterImageData: buildShowcaseFFTResult(cache, "lowpass", 35, lowpassResult),
            beforeLabel: "原圖",
            afterLabel: "低通結果",
            metrics: ["輪廓保留較多", "紋理被平滑"],
            note: "雲層與山勢會保留大結構，但細小紋理會被弱化。"
          }),
          makeSample({
            title: "高通濾波",
            description: "高通濾波只保留外圍的細節——也就是邊界與輪廓。你會看到，只剩下線條！",
            badges: ["模式：高通濾波", "強度：65"],
            mathMode: "FFT",
            params: { fftMode: "highpass", fftStrength: 65 },
            beforeImageData: source,
            afterImageData: buildShowcaseFFTResult(cache, "highpass", 65, highpassResult),
            beforeLabel: "原圖",
            afterLabel: "高通結果",
            metrics: ["邊界更突出", "整體灰階感增加"],
            note: "高通很適合拿來教學說明哪些資訊屬於輪廓、哪些屬於整體明暗。"
          })
        ],
        exercise: {
          question: "小練習：如果我把頻譜圖最中間那個最亮的點點塗黑，照片會發生什麼事？",
          answer: "頻譜圖正中間對應的是零頻率（DC component），代表整張圖的平均亮度。塗黑它會讓整張圖的平均亮度變暗甚至接近黑色，但整體形狀輪廓還在，因為那些是由周圍的低頻決定的。"
        }
      };
    } catch (error) {
      console.error("FFT 展示頁保底模式：", error);
      return {
        title: "FFT 頻率域處理",
        subtitle: "頻域觀察與濾波的固定案例展示",
        description: "FFT 就是把照片拆開成無數種『波浪紋路』。細碎的波代表細節，寬大的波代表輪廓。就像把音樂拆成高音和低音一樣。",
        mathMode: "FFT",
        params: { fftMode: "lowpass", fftStrength: 35 },
        formula: {
          label: "核心公式",
          expression: "$F(u,v) = \\sum_{x,y} f(x,y)\\, e^{-j2\\pi(\\frac{ux}{M} + \\frac{vy}{N})}$",
          hint: "頻譜圖中心 = 輪廓（低頻），外圍 = 細節（高頻）。低通擦外圍留大形狀，高通只留邊界線。"
        },
        headlineBadges: ["固定案例", "同框前後對比", "啟用保底預覽", "不留空白狀態"],
        summaryCards: [
          makeSummaryCard("保底策略", "先保住教學展示", "即使頻域計算失敗，也會提供可理解的靜態案例，讓展示頁保持完整。"),
          makeSummaryCard("頻域概念", "頻譜圖 = 波浪能量分布", "不管哪個模式，頻譜圖告訴你的都是同一件事：中間亮代表大形狀，外圍亮代表多細節。")
        ],
        samples: [
          makeSample({
            title: "頻譜示意",
            description: "頻譜圖把影像的能量翻譯成亮度分布：中心亮 = 大形狀（低頻），外圍亮 = 多細節（高頻）。",
            badges: ["模式：頻譜圖", "保底預覽"],
            mathMode: "FFT",
            params: { fftMode: "spectrum", fftStrength: 50 },
            beforeImageData: source,
            afterImageData: buildShowcaseFFTFallbackResult(source, "spectrum", 50),
            beforeLabel: "原圖",
            afterLabel: "保底預覽",
            metrics: ["動態 FFT 不可用", "仍可教學說明"],
            note: "這是概念示意圖，不代表完整頻域數值輸出。"
          }),
          makeSample({
            title: "低通示意",
            description: "低通濾波：把『小波紋』（高頻細節）擦掉，只留下『大波浪』（低頻輪廓），畫面會變得平滑、只剩下大形狀。",
            badges: ["模式：低通濾波", "保底預覽"],
            mathMode: "FFT",
            params: { fftMode: "lowpass", fftStrength: 35 },
            beforeImageData: source,
            afterImageData: buildShowcaseFFTFallbackResult(source, "lowpass", 35),
            beforeLabel: "原圖",
            afterLabel: "保底預覽",
            metrics: ["低頻概念保留", "畫面仍可比較"],
            note: "即使不是正式 FFT，也能清楚看見平滑方向與細節收斂。"
          }),
          makeSample({
            title: "高通示意",
            description: "高通濾波：只留『小波紋』，把『大波浪』削掉。只剩下線條和輪廓——這就是邊緣偵測的原理！",
            badges: ["模式：高通濾波", "保底預覽"],
            mathMode: "FFT",
            params: { fftMode: "highpass", fftStrength: 65 },
            beforeImageData: source,
            afterImageData: buildShowcaseFFTFallbackResult(source, "highpass", 65),
            beforeLabel: "原圖",
            afterLabel: "保底預覽",
            metrics: ["高頻概念保留", "可觀察輪廓提升"],
            note: "保底圖會偏向空間域的邊緣強調，但仍能支撐頻域教學。"
          })
        ],
        exercise: {
          question: "小練習：如果我把頻譜圖最中間那個最亮的點點塗黑，照片會發生什麼事？",
          answer: "頻譜圖正中間對應的是零頻率，代表整張圖的平均亮度。塗黑它會讓整張圖的平均亮度變暗，但整體形狀輪廓還在，因為那些是由周圍的低頻決定的。"
        }
      };
    }
  }

  async function renderShowcasePCA() {
    const source = showcaseState.imageAData;
    try {
      const cache = await ensureShowcasePCACache(source);
      const low = buildShowcasePCAResult(cache, 25);
      const mid = buildShowcasePCAResult(cache, 50);
      const high = buildShowcasePCAResult(cache, 80);
      return {
        title: "PCA 主成分分析",
        subtitle: "主成分重建的固定案例展示",
        description: "PCA 就是找出這張照片的『靈魂』。把不重要的資訊通通丟掉，只用極少量的數據就能還原出這張圖。常用在：人臉辨識（抓關鍵特徵）、衛星影像壓縮、大數據趨勢預測。",
        mathMode: "PCA",
        params: { pcaRetention: 50, pcaWorkWidth: cache.width, pcaWorkHeight: cache.height },
        formula: {
          label: "核心公式",
          expression: "$X \\approx U_k \\cdot \\Sigma_k \\cdot V_k^T$",
          hint: "當你把『保留比例』調低時，電腦正在拋棄不重要的像素變化。你會發現畫面變得有一點方塊感，但重要的輪廓（主成分）都在。這就是為什麼可以把幾百 MB 的照片壓縮得很小，卻還能認出原本的畫面輪廓！"
        },
        headlineBadges: ["固定案例", "同框前後對比", "顯示參數", "保留率 / 指標"],
        summaryCards: [
          makeSummaryCard("核心概念", "PCA = 找照片的靈魂", "PCA 不會逐像素複製，而是找出哪些方向『變化最大』——那些方向就是主成分，包含了圖像最重要的結構。"),
          makeSummaryCard("壓縮原理", "拋棄不重要的方向", "調低保留比例 = 電腦認定『這個方向不重要，砍掉也沒關係』，畫面會有一點模糊但輪廓仍在。"),
          makeSummaryCard("為什麼有效", "圖像變化本來就有規律", "自然圖像裡，相鄰像素通常會一起變亮或變暗，這就是規律。PCA 把這些規律抽出來，少量數據就能描述大量像素。")
        ],
        samples: [
          makeSample({
            title: "低保留率",
            description: "當你把『保留比例』調低時，電腦正在拋棄不重要的像素變化。你會發現畫面變得有一點方塊感，但重要的輪廓（主成分）都在。這就是為什麼可以把幾百 MB 的照片壓縮得很小，卻還能認出原本的畫面輪廓！",
            badges: ["保留率 25%"],
            mathMode: "PCA",
            params: { pcaRetention: 25, pcaWorkWidth: cache.width, pcaWorkHeight: cache.height },
            beforeImageData: source,
            afterImageData: low.imageData,
            beforeLabel: "原圖",
            afterLabel: "PCA 重建",
            metrics: [`壓縮比 ${formatRatio(low.compressionRatio)}`, `資訊保留 ${formatPercent(low.infoRetention)}`],
            note: "輪廓仍在，但細節與層次會大幅減少，是最容易看懂 PCA 捨棄資訊的案例。"
          }),
          makeSample({
            title: "中保留率",
            description: "在畫質與壓縮之間取得更平衡的中段案例。調到 50% 時，電腦覺得『有一半的變化方向可以砍』，但實際畫面已經相當接近原圖了。",
            badges: ["保留率 50%"],
            mathMode: "PCA",
            params: { pcaRetention: 50, pcaWorkWidth: cache.width, pcaWorkHeight: cache.height },
            beforeImageData: source,
            afterImageData: mid.imageData,
            beforeLabel: "原圖",
            afterLabel: "PCA 重建",
            metrics: [`壓縮比 ${formatRatio(mid.compressionRatio)}`, `資訊保留 ${formatPercent(mid.infoRetention)}`],
            note: "這一組很適合教學展示，因為畫面可辨識度與壓縮效果都還有代表性。"
          }),
          makeSample({
            title: "高保留率",
            description: "保留更多主成分，讓重建結果更接近原始畫面。調到 80% 時，視覺上已經很難發現差異，但壓縮效果依然存在。",
            badges: ["保留率 80%"],
            mathMode: "PCA",
            params: { pcaRetention: 80, pcaWorkWidth: cache.width, pcaWorkHeight: cache.height },
            beforeImageData: source,
            afterImageData: high.imageData,
            beforeLabel: "原圖",
            afterLabel: "PCA 重建",
            metrics: [`壓縮比 ${formatRatio(high.compressionRatio)}`, `資訊保留 ${formatPercent(high.infoRetention)}`],
            note: "高保留率下，整體階調更完整，但壓縮優勢也會相對降低。"
          })
        ],
        exercise: {
          question: "小練習：如果一張照片只有一種顏色（全白），你覺得 PCA 需要多少特徵向量就能完美還原它？",
          answer: "只需要 1 個特徵向量就能完美還原。因為全白照片的像素之間完全沒有變異——所有像素值都一樣，所以『最大的變化方向』只有一個，PCA 只需要一個主成分就能完整描述這張圖。"
        }
      };
    } catch (error) {
      console.error("PCA 展示頁保底模式：", error);
      const low = buildShowcasePCAFallbackResult(source, 25);
      const mid = buildShowcasePCAFallbackResult(source, 50);
      const high = buildShowcasePCAFallbackResult(source, 80);
      return {
        title: "PCA 主成分分析",
        subtitle: "主成分重建的固定案例展示",
        description: "PCA 就是找出這張照片的『靈魂』。把不重要的資訊通通丟掉，只用極少量的數據就能還原出這張圖。常用在：人臉辨識、衛星影像壓縮、大數據趨勢預測。",
        mathMode: "PCA",
        params: { pcaRetention: 50, pcaWorkWidth: 64, pcaWorkHeight: 32 },
        formula: {
          label: "核心公式",
          expression: "$X \\approx U_k \\cdot \\Sigma_k \\cdot V_k^T$",
          hint: "不管哪個模式，PCA 都在問同一件事：哪些方向『變化最大』？那些方向就是主成分。拋棄不重要的方向，圖像就能被更少數據描述。"
        },
        headlineBadges: ["固定案例", "同框前後對比", "啟用保底預覽", "保留率仍可比較"],
        summaryCards: [
          makeSummaryCard("保底策略", "先保住重建對照", "就算無法完成 PCA 分解，仍會用固定保留率概念呈現重建方向。"),
          makeSummaryCard("PCA 核心概念", "找照片的靈魂 + 拋棄不重要的方向", "不管哪個模式，調低保留比例 = 電腦砍掉不重要的變化方向，輪廓還在但細節會減少。")
        ],
        samples: [
          makeSample({
            title: "低保留率",
            description: "保留比例 25% = 電腦覺得『四分之三的方向都不重要，可以砍』。結果：輪廓還在，方塊感增加，細節減少。",
            badges: ["保留率 25%", "保底預覽"],
            mathMode: "PCA",
            params: { pcaRetention: 25 },
            beforeImageData: source,
            afterImageData: low.imageData,
            beforeLabel: "原圖",
            afterLabel: "保底預覽",
            metrics: ["壓縮指標不提供", "適合看細節流失"],
            note: "保底模式下仍能觀察保留率差異，但不顯示正式估計數值。"
          }),
          makeSample({
            title: "中保留率",
            description: "保留比例 50% = 砍掉一半方向。結果：視覺上已經相當接近原圖，但仔細看還是有一點模糊。",
            badges: ["保留率 50%", "保底預覽"],
            mathMode: "PCA",
            params: { pcaRetention: 50 },
            beforeImageData: source,
            afterImageData: mid.imageData,
            beforeLabel: "原圖",
            afterLabel: "保底預覽",
            metrics: ["壓縮指標不提供", "適合看結構保留"],
            note: "中段案例仍是最容易向使用者說明保留率概念的一組。"
          }),
          makeSample({
            title: "高保留率",
            description: "保留比例 80% = 只砍掉兩成方向。結果：視覺上很難發現差異，但壓縮效果依然存在。",
            badges: ["保留率 80%", "保底預覽"],
            mathMode: "PCA",
            params: { pcaRetention: 80 },
            beforeImageData: source,
            afterImageData: high.imageData,
            beforeLabel: "原圖",
            afterLabel: "保底預覽",
            metrics: ["壓縮指標不提供", "適合看層次接近原圖"],
            note: "高保留率保住了較多階調，但仍是示意圖而非正式 PCA 解。"
          })
        ],
        exercise: {
          question: "小練習：如果一張照片只有一種顏色（全白），你覺得 PCA 需要多少特徵向量就能完美還原它？",
          answer: "只需要 1 個特徵向量就能完美還原。因為全白照片的像素之間完全沒有變異，『最大的變化方向』只有一個。"
        }
      };
    }
  }

  async function renderShowcaseSpatialFilter() {
    const source = await loadShowcaseSpecificImage(SHOWCASE_CITY_IMAGE_URL, showcaseState.imageAData);
    return {
      title: "空間卷積濾鏡",
      subtitle: "卷積核心效果的固定案例展示",
      description: "空間卷積濾鏡就是讓像素去跟『隔壁鄰居』打招呼，計算出新的顏色。有的濾鏡會讓照片變模糊，有的會讓邊緣變得像刀割一樣尖銳。常用在：照片去雜訊、背景模糊效果、加強文字銳利度。",
      mathMode: "SPATIAL",
      params: { filterMode: "gaussian", kernelSize: 5 },
      formula: {
        label: "核心公式",
        expression: "$g(x,y) = \\sum_{i,j} w(i,j) \\cdot f(x+i,\\, y+j)$",
        hint: "想像你拿著一個 3×3 的小格子在照片上滑動，小格子會把九個像素的數字平均一下，這就是模糊；如果是把中間的數字變大、旁邊變小，這就是銳化。"
      },
      headlineBadges: ["固定案例", "同框前後對比", "顯示參數", "模式 / 強度"],
      summaryCards: [
        makeSummaryCard("核心動作", "卷積：像素去跟鄰居打招呼", "每個輸出像素都參考了周圍鄰居的加權值，這就是『卷積』的本質。"),
        makeSummaryCard("濾鏡原理", "kernel 權重決定效果", "同樣的鄰域加權方式，可以得到平滑、銳化或邊緣強化，關鍵就在 kernel 的設計。"),
        makeSummaryCard("互動建議", "回到首頁開啟『探針』查看數字矩陣", "移到圖片上可以看到那些跳動的 3×3 數字矩陣，直觀理解卷積在算什麼。")
      ],
      samples: [
        makeSample({
          title: "高斯平滑",
          description: "這個動作叫『卷積』。想像你拿著一個 3×3 的小格子在照片上滑動，小格子會把九個像素的數字平均一下，這就是模糊。你可以回到首頁，開啟左側工具列的『探針 (Probe)』，親眼看看這些矩陣數字是如何被計算出來的。",
          badges: ["模式：高斯平滑", "強度：20"],
          mathMode: "SPATIAL",
          params: { filterMode: "gaussian", kernelSize: 5 },
          beforeImageData: source,
          afterImageData: buildShowcaseSpatialFilterImage(source, "gaussian", 20),
          beforeLabel: "原圖",
          afterLabel: "平滑後",
          metrics: ["適合去噪示意", "高頻細節減少"],
          note: "平滑案例最適合拿來說明為什麼先去噪再做邊緣偵測。"
        }),
        makeSample({
          title: "銳化",
          description: "如果是把中間的數字變大、旁邊變小，這就是銳化。你看邊緣是不是突然變得清晰了？",
          badges: ["模式：銳化", "強度：45"],
          mathMode: "SPATIAL",
          params: { filterMode: "sharpen", kernelSize: 5 },
          beforeImageData: source,
          afterImageData: buildShowcaseSpatialFilterImage(source, "sharpen", 45),
          beforeLabel: "原圖",
          afterLabel: "銳化後",
          metrics: ["局部邊界更集中", "雜訊也可能被放大"],
          note: "銳化會讓細節更突出，但在低品質影像上也可能一起放大雜訊。"
        }),
        makeSample({
          title: "邊緣強化",
          description: "直接把亮暗變化劇烈的位置標記出來，方便觀察輪廓在哪裡。",
          badges: ["模式：邊緣強化", "強度：70"],
          mathMode: "SPATIAL",
          params: { filterMode: "edge", kernelSize: 5 },
          beforeImageData: source,
          afterImageData: buildShowcaseSpatialFilterImage(source, "edge", 70),
          beforeLabel: "原圖",
          afterLabel: "邊緣圖",
          metrics: ["輪廓更清楚", "灰階邊界最直觀"],
          note: "這組會把視覺焦點轉向輪廓，和 Canny 展示可以形成很好的教學對照。"
        })
      ],
      exercise: {
        question: "小練習：如果一個 3×3 的格子裡面九個數字通通都是 1/9，你覺得這張圖會變模糊還是變銳利？",
        answer: "會變模糊。因為 1/9 的意思是把周圍九個像素全部平等平均，平均的結果會讓相鄰像素趨向同一個值，細節會被抹平——這正是模糊的核心原理。"
      }
    };
  }

  async function renderShowcaseCanny() {
    const source = await loadShowcaseSpecificImage(SHOWCASE_ROAD_IMAGE_URL, showcaseState.imageAData);
    const cases = [
      { title: "細緻輪廓", blur: 2, low: 24, high: 72, description: "模糊量較低，會保留較多細線與局部邊緣。適合在乾淨的環境下找出所有可能的邊界。", sampleDesc: "模糊量低 = 先去一點雜訊，但盡量保留細節。你看，連柏油路面的細微紋理都被標記出來了！" },
      { title: "平衡輸出", blur: 3, low: 42, high: 108, description: "在抑制雜訊與保留輪廓之間取得較平均的結果。", sampleDesc: "你看，車道線與主要道路邊緣現在是不是超清楚？中等模糊量把路面細碎的雜訊抹掉了，只留下真正的結構邊界。" },
      { title: "穩定輪廓", blur: 5, low: 60, high: 150, description: "提高平滑與閾值後，輸出會更乾淨，但細碎邊緣也會被捨棄。適合自動駕駛、工廠零件辨識等需要穩定輸出的場景。", sampleDesc: "模糊量高 = 先狠狠去噪。畫面超乾淨，輪廓清晰，適合拿去做下一步判斷。" }
    ];
    const samples = [];
    let fallbackMode = false;
    for (const item of cases) {
      let result;
      try {
        result = await computeCannyEdgeData(source, item.blur, item.low, item.high);
      } catch (error) {
        console.warn("Worker 加速失敗，改用主執行緒 fallback:", error);
        result = computeCannyEdgeDataFallback(source, item.blur, item.low, item.high);
        fallbackMode = true;
      }
      samples.push(
        makeSample({
          title: item.title,
          description: item.sampleDesc,
          badges: [`blur: ${item.blur}`, `low: ${item.low}`, `high: ${item.high}`, fallbackMode ? "主執行緒 Fallback" : "Worker 加速"],
          mathMode: "CANNY",
          params: { cannyBlur: item.blur, cannyLow: item.low, cannyHigh: item.high },
          beforeImageData: source,
          afterImageData: result.imageData,
          beforeLabel: "原圖",
          afterLabel: "Canny 邊緣",
          metrics: [`邊緣覆蓋 ${formatCoverage(result.edgeCoverage)}`, fallbackMode ? "主執行緒 Fallback" : "Worker 加速"],
          note:
            item.blur <= 2
              ? "較低模糊量會留下更多細節，適合展示 Canny 如何捕捉細碎輪廓。"
              : item.blur >= 5
                ? "較高模糊量可先壓掉雜訊，讓輸出更乾淨，適合文件與工業檢測示意。"
                : "中段參數最適合當教學基準，輪廓與穩定度都比較平均。"
        })
      );
      await yieldToBrowser();
    }
    const description = fallbackMode
      ? "Canny 就是把照片變成『簡筆劃』。電腦會去找出顏色變化最劇烈的地方（邊界），然後把它畫成白線，其餘黑色。常用在：自動駕駛辨識車道線、工業機器人抓取零件、手機掃描文件自動切邊。（目前使用主執行緒 Fallback 模式）"
      : "Canny 就是把照片變成『簡筆劃』。電腦會去找出顏色變化最劇烈的地方（邊界），然後把它畫成白線，其餘黑色。常用在：自動駕駛辨識車道線、工業機器人抓取零件、手機掃描文件自動切邊。";
    const headlineBadges = fallbackMode
      ? ["固定案例", "同框前後對比", "顯示參數", "多步驟輪廓擷取", "主執行緒 Fallback"]
      : ["固定案例", "同框前後對比", "顯示參數", "多步驟輪廓擷取", "Worker 加速"];
    return {
      title: "Canny 邊緣偵測",
      subtitle: "把照片變成『簡筆劃』的固定案例展示",
      description: description,
      mathMode: "CANNY",
      params: { cannyBlur: 3, cannyLow: 42, cannyHigh: 108 },
      formula: {
        label: "核心公式",
        expression: "$G = \\sqrt{G_x^2 + G_y^2}, \\quad \\theta = \\arctan\\frac{G_y}{G_x}$",
        hint: "高門檻像挑剔的老師，只讓最明顯的邊緣及格；低門檻則幫忙把斷掉的線接回來。首先調高『高斯模糊』過濾雜點，接著調整『門檻』。",
      },
      headlineBadges: headlineBadges,
      summaryCards: [
        makeSummaryCard("核心動作", "Canny = 把照片變成簡筆劃", "找出顏色變化最劇烈的地方，畫成白線，其餘全黑。這就是『邊緣偵測』的終極目標。"),
        makeSummaryCard("參數原理", "blur 越大先去越多噪 | low/high 決定及格線", "blur 先把雜訊抹平，low/high 雙閾值則決定哪些邊緣算『真的邊緣』：高分過關的叫強邊緣，低分但連上強邊緣的叫弱邊緣。"),
        makeSummaryCard("常用場景", "自動駕駛、文件掃描、工業檢測", "只要需要『輪廓比色彩更重要』的場合，Canny 都是首選前處理工具。")
      ],
      samples,
      exercise: {
        question: "小練習：如果要讓自動駕駛在雨天也能看清車道，你覺得『高斯模糊』應該調高還是調低？為什麼？",
        answer: "應該調高。雨天的影像會有大量雨滴和水花的雜訊，如果模糊量不夠，這些小乾擾都會被誤判成邊緣。提高高斯模糊可以先把這些雨滴噪點抹平，讓真正的車道線（強邊緣）浮現出來，避免誤判。"
      }
    };
  }

  const showcaseRenderers = Object.freeze({
    "brightness-contrast": renderShowcaseBrightnessContrast,
    blend: renderShowcaseBlend,
    mosaic: renderShowcaseMosaic,
    fft: renderShowcaseFFT,
    pca: renderShowcasePCA,
    "spatial-filter": renderShowcaseSpatialFilter,
    canny: renderShowcaseCanny,
    lsb: renderShowcaseLSB
  });

  async function renderShowcaseTopic() {
    const renderer = showcaseRenderers[showcaseState.topic];
    if (!renderer) {
      console.error("[Showcase] 找不到對應的主題渲染器：", showcaseState.topic);
      return;
    }
    if (!showcaseState.imageAData) {
      console.warn("[Showcase] imageAData 尚未準備好，跳過渲染。");
      return;
    }
    closeShowcaseLightbox();
    const renderToken = ++showcaseState.renderToken;
    updateActiveTopicButtons();
    const topicLabel = getTopicLabel(showcaseState.topic);
    setShowcaseLoading(`正在切換「${topicLabel}」`, "系統會先顯示骨架內容，再建立固定參數的比較案例。");
    console.log("[Showcase] ▶ 開始準備教學主題：", topicLabel, "(", showcaseState.topic, ")");
    try {
      const model = await renderer();
      console.log("[Showcase] ✓ 完成準備教學主題：", topicLabel);
      if (renderToken !== showcaseState.renderToken) {
        console.log("[Showcase] 已被其他主題覆蓋，放棄渲染：", topicLabel);
        return;
      }
      showcaseContent.setAttribute("aria-busy", "false");
      showcaseContent.classList.remove("is-loading");
      showcaseContent.replaceChildren(buildShowcaseTopicView(model));
      window.dispatchEvent(new Event("resize"));
      
      // 渲染 MathJax 公式
      ensureMathJaxReady(function() {
        window.MathJax.typesetPromise([showcaseContent]).catch(function(err) {
          console.log('MathJax typeset error:', err);
        });
      });
    } catch (error) {
      if (renderToken !== showcaseState.renderToken) {
        return;
      }
      console.error("[Showcase] ✗ 渲染失敗「" + topicLabel + "」：", error);
      showcaseContent.setAttribute("aria-busy", "false");
      showcaseContent.classList.remove("is-loading");
      showcaseContent.replaceChildren(
        createEmptyState("載入失敗", "展示內容無法建立", "請重新整理頁面後再試一次，或稍後切換到其他主題。")
      );
    } finally {
      // stale-render early-return 時仍需清除 loading 狀態
      if (renderToken !== showcaseState.renderToken) {
        showcaseContent.setAttribute("aria-busy", "false");
        showcaseContent.classList.remove("is-loading");
      }
    }
  }

  function bindEvents() {
    if (showcaseState.eventsBound) {
      return;
    }
    showcaseState.eventsBound = true;
    topicButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextTopic = button.dataset.showcaseTopic;
        if (!nextTopic || nextTopic === showcaseState.topic) {
          return;
        }
        showcaseState.topic = nextTopic;
        void renderShowcaseTopic();
      });
    });
    showcaseContent.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const previewCanvas = event.target.closest(".showcase-preview-trigger");
      if (previewCanvas instanceof HTMLCanvasElement) {
        openShowcaseLightboxFromCanvas(previewCanvas);
      }
    });
    showcaseContent.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      if (!(event.target instanceof HTMLCanvasElement) || !event.target.classList.contains("showcase-preview-trigger")) {
        return;
      }
      event.preventDefault();
      openShowcaseLightboxFromCanvas(event.target);
    });
    if (showcaseLightbox) {
      showcaseLightbox.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }
        const shouldClose = event.target === showcaseLightbox || event.target.closest("[data-showcase-lightbox-close]");
        if (shouldClose) {
          closeShowcaseLightbox();
        }
      });
    }
    if (showcaseLightboxFitBtn) {
      showcaseLightboxFitBtn.addEventListener("click", () => {
        resetShowcaseLightboxZoom();
        syncShowcaseLightboxViewport();
      });
    }
    if (showcaseLightboxZoom100Btn) {
      showcaseLightboxZoom100Btn.addEventListener("click", () => {
        const fitScale = showcaseState.lightboxFitScale || 1;
        setShowcaseLightboxZoom(1 / fitScale);
      });
    }
    if (showcaseLightboxZoom200Btn) {
      showcaseLightboxZoom200Btn.addEventListener("click", () => {
        const fitScale = showcaseState.lightboxFitScale || 1;
        setShowcaseLightboxZoom(2 / fitScale);
      });
    }
    if (showcaseLightboxResetBtn) {
      showcaseLightboxResetBtn.addEventListener("click", () => {
        resetShowcaseLightboxZoom();
        syncShowcaseLightboxViewport();
      });
    }
    if (showcaseLightboxCompare) {
      showcaseLightboxCompare.addEventListener("dblclick", (event) => {
        event.preventDefault();
        const fitScale = showcaseState.lightboxFitScale || 1;
        const actualScale = fitScale * showcaseState.lightboxZoom;
        const targetZoom = actualScale >= 2 ? 1 : 2 / fitScale;
        setShowcaseLightboxZoom(targetZoom, event.clientX, event.clientY);
      });
      showcaseLightboxCompare.addEventListener(
        "wheel",
        (event) => {
          if (!showcaseState.lightboxPayload) {
            return;
          }
          event.preventDefault();
          const delta = event.deltaY < 0 ? 0.24 : -0.24;
          setShowcaseLightboxZoom(showcaseState.lightboxZoom + delta, event.clientX, event.clientY);
        },
        { passive: false }
      );
      showcaseLightboxCompare.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || showcaseState.lightboxZoom <= 1) {
          return;
        }
        event.preventDefault();
        beginShowcasePan(event);
      });
      showcaseLightboxCompare.addEventListener("pointermove", (event) => {
        updateShowcasePan(event);
      });
      showcaseLightboxCompare.addEventListener("pointerup", (event) => {
        endShowcasePan(event);
      });
      showcaseLightboxCompare.addEventListener("pointercancel", (event) => {
        endShowcasePan(event);
      });
      showcaseLightboxCompare.addEventListener("lostpointercapture", () => {
        endShowcasePan();
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeShowcaseLightbox();
      }
    });
    window.addEventListener("resize", () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        if (!showcaseLightbox?.hidden) {
          syncShowcaseLightboxViewport();
        }
      }, 150);
    });
  }

  async function initializeShowcase() {
    bindEvents();
    setShowcaseLoading("載入示範資料中", "展示頁會建立自己的示範影像資料，不會共用首頁互動狀態。");

    let baseImage;
    try {
      baseImage = await loadShowcaseBaseImage();
    } catch (error) {
      console.error("[Showcase] loadShowcaseBaseImage 發生未捕捉錯誤：", error);
      baseImage = normalizeShowcaseImageSize(generateShowcaseFallbackImage());
    }

    if (!baseImage) {
      console.error("[Showcase] baseImage 為 null/undefined，使用保底圖。");
      baseImage = normalizeShowcaseImageSize(generateShowcaseFallbackImage());
    }

    showcaseState.imageAData = baseImage;
    try {
      // 嘗試讀取同一目錄下的 KY.png
      const imgB = await loadImageElement("./KY.png", "找不到 KY.png");
      const imgBData = imageElementToImageData(imgB);
      
      // 強制將 KY.png 縮放成跟 A 圖一模一樣的尺寸
      showcaseState.imageBData = scaleImageDataToSize(
        imgBData, 
        baseImage.width, 
        baseImage.height, 
        { smoothing: true }
      );
      console.log("[Showcase] 成功載入 KY.png 並自動對齊尺寸作為 B 圖！");
      
    } catch (err) {
      // 防呆機制：如果 KY.png 載入失敗，安全退回預設生成的漸層圖
      console.warn("[Showcase] KY.png 載入失敗，改用預設的風格圖：", err);
      showcaseState.imageBData = buildShowcaseCompanionImage(baseImage);
    }

    try {
      await renderShowcaseTopic();
    } catch (error) {
      console.error("[Showcase] renderShowcaseTopic 發生未捕捉錯誤：", error);
      showcaseContent.setAttribute("aria-busy", "false");
      showcaseContent.classList.remove("is-loading");
      showcaseContent.replaceChildren(
        createEmptyState("初始化失敗", "展示頁無法建立內容", "請重新整理頁面，或檢查 F12 主控台是否有錯誤資訊。")
      );
    }
  }

  void initializeShowcase();
})();