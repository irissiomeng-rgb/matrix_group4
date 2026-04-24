(() => {
      "use strict";

      const DISPLAY_CANVAS_WIDTH = 600;
      const DISPLAY_CANVAS_HEIGHT = 400;
      const WORKSPACE_LONG_EDGE_LIMIT = 1200;
      const LSB_HEADER_BITS = 32;
      const CHANNELS = 4;

      function renderMathJax() {
        function doRender() {
          if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([document.body]).catch(function(err) {
              console.log('MathJax typeset error:', err);
            });
          }
        }
        if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
          window.MathJax.startup.promise.then(function() {
            setTimeout(doRender, 500);
          }).catch(function(err) {
            console.log('MathJax startup promise error:', err);
            setTimeout(doRender, 500);
          });
        } else {
          window.addEventListener("load", function() {
            setTimeout(doRender, 500);
          });
        }
      }

      function typesetMath(element) {
        if (!element) return;
        function doTypeset() {
          if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([element]).catch(function(err) {
              console.log('MathJax typeset error:', err);
            });
          }
        }
        if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
          window.MathJax.startup.promise.then(function() {
            setTimeout(doTypeset, 500);
          }).catch(function(err) {
            console.log('MathJax startup promise error:', err);
            setTimeout(doTypeset, 500);
          });
        } else {
          window.addEventListener("load", function() {
            setTimeout(doTypeset, 500);
          });
        }
      }

      const mainCanvas = document.getElementById("mainCanvas");
      const ctx = mainCanvas.getContext("2d", { willReadFrequently: true });
      const canvasWrap = document.querySelector(".canvas-wrap");
      const mainCanvasOverlay = document.getElementById("mainCanvasOverlay");
      const overlayCtx = mainCanvasOverlay ? mainCanvasOverlay.getContext("2d") : null;
      const previewA = document.getElementById("previewA");
      const previewB = document.getElementById("previewB");
      const previewACtx = previewA.getContext("2d");
      const previewBCtx = previewB.getContext("2d");

      const statusText = document.getElementById("statusText");
      const modeText = document.getElementById("modeText");
      const loadingBadge = document.getElementById("loadingBadge");
      const toastHost = document.getElementById("toastHost");

      const dropZone = document.getElementById("dropZone");
      const fileInputA = document.getElementById("fileInputA");
      const fileInputB = document.getElementById("fileInputB");
      const loadDemoSakuraBtn = document.getElementById("loadDemoSakuraBtn");
      const imageInfoA = document.getElementById("imageInfoA");
      const imageInfoB = document.getElementById("imageInfoB");

      const restoreBtn = document.getElementById("restoreBtn");
      const undoBtn = document.getElementById("undoBtn");
      const redoBtn = document.getElementById("redoBtn");
      const cancelPreviewBtn = document.getElementById("cancelPreviewBtn");
      const exportBtn = document.getElementById("exportBtn");
      const exportModeSelect = document.getElementById("exportMode");
      const clearABtn = document.getElementById("clearABtn");
      const clearBBtn = document.getElementById("clearBBtn");
      const compareViewBtn = document.getElementById("compareViewBtn");
      const compareModal = document.getElementById("compareModal");
      const compareModalBackdrop = document.getElementById("compareModalBackdrop");
      const compareModalClose = document.getElementById("compareModalClose");
      const mathBridgeContent = document.getElementById("mathBridgeContent");
      const compareBeforeLabel = document.getElementById("compareBeforeLabel");
      const compareAfterLabel = document.getElementById("compareAfterLabel");
      const compareBeforeCanvas = document.getElementById("compareBeforeCanvas");
      const compareAfterCanvas = document.getElementById("compareAfterCanvas");
      const compareBeforeCtx = compareBeforeCanvas
        ? compareBeforeCanvas.getContext("2d", { willReadFrequently: true })
        : null;
      const compareAfterCtx = compareAfterCanvas
        ? compareAfterCanvas.getContext("2d", { willReadFrequently: true })
        : null;
      const compareModalPointText = document.getElementById("compareModalPointText");
      const compareModalSampleText = document.getElementById("compareModalSampleText");
      const compareBeforeRgb = document.getElementById("compareBeforeRgb");
      const compareAfterRgb = document.getElementById("compareAfterRgb");
      const compareBeforeMatrixR = document.getElementById("compareBeforeMatrixR");
      const compareBeforeMatrixG = document.getElementById("compareBeforeMatrixG");
      const compareBeforeMatrixB = document.getElementById("compareBeforeMatrixB");
      const compareAfterMatrixR = document.getElementById("compareAfterMatrixR");
      const compareAfterMatrixG = document.getElementById("compareAfterMatrixG");
      const compareAfterMatrixB = document.getElementById("compareAfterMatrixB");
      const historyBadge = document.getElementById("historyBadge");
      const channelBtns = Array.from(document.querySelectorAll(".channel-btn"));
      const matrixChannelBtns = Array.from(document.querySelectorAll(".matrix-channel-btn"));
      const matrixPanels = Array.from(document.querySelectorAll(".matrix-tab-panel"));
      const sampleSizeValue = document.getElementById("sampleSizeValue");
      const centerPixelEcho = document.getElementById("centerPixelEcho");
      const moreToolsToggle = document.getElementById("moreToolsToggle");
      const secondaryToolsTray = document.getElementById("secondaryToolsTray");

      const brightnessInput = document.getElementById("brightness");
      const contrastInput = document.getElementById("contrast");
      const brightnessVal = document.getElementById("brightnessVal");
      const contrastVal = document.getElementById("contrastVal");
      const bcFormula = document.getElementById("bcFormula");
      const applyBCBtn = document.getElementById("applyBCBtn");

      const blendAlphaInput = document.getElementById("blendAlpha");
      const blendAlphaVal = document.getElementById("blendAlphaVal");
      const blendFormula = document.getElementById("blendFormula");
      const applyBlendBtn = document.getElementById("applyBlendBtn");

      const blockSizeInput = document.getElementById("blockSize");
      const blockSizeVal = document.getElementById("blockSizeVal");
      const applyMosaicBtn = document.getElementById("applyMosaicBtn");

      const watermarkTextInput = document.getElementById("watermarkText");
      const watermarkPosInput = document.getElementById("watermarkPos");
      const watermarkAlphaInput = document.getElementById("watermarkAlpha");
      const watermarkAlphaVal = document.getElementById("watermarkAlphaVal");
      const applyWatermarkBtn = document.getElementById("applyWatermarkBtn");

      const sampleSizeInput = document.getElementById("sampleSize");
      const coordText = document.getElementById("coordText");
      const centerPixelText = document.getElementById("centerPixelText");
      const matrixRangeText = document.getElementById("matrixRangeText");
      const matrixR = document.getElementById("matrixR");
      const matrixG = document.getElementById("matrixG");
      const matrixB = document.getElementById("matrixB");
      const matrixContent = document.getElementById("matrixContent");
      const toggleMatrixBtn = document.getElementById("toggleMatrixBtn");

      const capacityText = document.getElementById("capacityText");
      const stegoMessageInput = document.getElementById("stegoMessage");
      const stegoOutput = document.getElementById("stegoOutput");
      const embedBtn = document.getElementById("embedBtn");
      const extractBtn = document.getElementById("extractBtn");
      const watermarkPosButtons = Array.from(document.querySelectorAll("[data-watermark-pos]"));

      const fftModeButtons = Array.from(document.querySelectorAll("[data-fft-mode]"));
      const fftStrengthInput = document.getElementById("fftStrength");
      const fftStrengthVal = document.getElementById("fftStrengthVal");
      const fftPreviewSource = document.getElementById("fftPreviewSource");
      const fftPreviewResult = document.getElementById("fftPreviewResult");
      const fftPreviewSourceCtx = fftPreviewSource ? fftPreviewSource.getContext("2d") : null;
      const fftPreviewResultCtx = fftPreviewResult ? fftPreviewResult.getContext("2d") : null;
      const applyFFTBtn = document.getElementById("applyFFTBtn");

      const pcaRetentionInput = document.getElementById("pcaRetention");
      const pcaRetentionVal = document.getElementById("pcaRetentionVal");
      const pcaPreviewSource = document.getElementById("pcaPreviewSource");
      const pcaPreviewLatent = document.getElementById("pcaPreviewLatent");
      const pcaPreviewResult = document.getElementById("pcaPreviewResult");
      const pcaPreviewSourceCtx = pcaPreviewSource ? pcaPreviewSource.getContext("2d") : null;
      const pcaPreviewLatentCtx = pcaPreviewLatent ? pcaPreviewLatent.getContext("2d") : null;
      const pcaPreviewResultCtx = pcaPreviewResult ? pcaPreviewResult.getContext("2d") : null;
      const pcaCompressionRatio = document.getElementById("pcaCompressionRatio");
      const pcaInfoRetention = document.getElementById("pcaInfoRetention");
      const applyPCABtn = document.getElementById("applyPCABtn");
      const filterModeButtons = Array.from(document.querySelectorAll("[data-filter-mode]"));
      const spatialFilterStrengthInput = document.getElementById("spatialFilterStrength");
      const spatialFilterStrengthVal = document.getElementById("spatialFilterStrengthVal");
      const spatialFilterStrengthLabel = document.getElementById("spatialFilterStrengthLabel");
      const spatialFilterFormula = document.getElementById("spatialFilterFormula");
      const spatialFilterPreviewSource = document.getElementById("spatialFilterPreviewSource");
      const spatialFilterPreviewResult = document.getElementById("spatialFilterPreviewResult");
      const spatialFilterPreviewSourceCtx = spatialFilterPreviewSource ? spatialFilterPreviewSource.getContext("2d") : null;
      const spatialFilterPreviewResultCtx = spatialFilterPreviewResult ? spatialFilterPreviewResult.getContext("2d") : null;
      let spatialFilterPreviewInfo = null;
      const applySpatialFilterBtn = document.getElementById("applySpatialFilterBtn");
      const cannyBlurInput = document.getElementById("cannyBlur");
      const cannyBlurVal = document.getElementById("cannyBlurVal");
      const cannyBlurBubble = document.getElementById("cannyBlurBubble");
      const cannyLowThresholdInput = document.getElementById("cannyLowThreshold");
      const cannyLowThresholdVal = document.getElementById("cannyLowThresholdVal");
      const cannyLowThresholdBubble = document.getElementById("cannyLowThresholdBubble");
      const cannyHighThresholdInput = document.getElementById("cannyHighThreshold");
      const cannyHighThresholdVal = document.getElementById("cannyHighThresholdVal");
      const cannyHighThresholdBubble = document.getElementById("cannyHighThresholdBubble");
      const cannyPreviewSource = document.getElementById("cannyPreviewSource");
      const cannyPreviewResult = document.getElementById("cannyPreviewResult");
      const cannyPreviewSourceCtx = cannyPreviewSource ? cannyPreviewSource.getContext("2d") : null;
      const cannyPreviewResultCtx = cannyPreviewResult ? cannyPreviewResult.getContext("2d") : null;
      const cannyEdgeCount = document.getElementById("cannyEdgeCount");
      const cannyWeakLinkCount = document.getElementById("cannyWeakLinkCount");
      const cannyEdgeDensity = document.getElementById("cannyEdgeDensity");
      const applyCannyBtn = document.getElementById("applyCannyBtn");
      const cannyLongPressOverlay = document.getElementById("cannyLongPressOverlay");

      let originalImageData = null;
      let currentImageData = null;
      let imageBData = null;
      let displayMode = "rgb";
      let matrixViewChannel = "r";
      let selectedPoint = { x: 0, y: 0 };
      let sampleSizeN = 10;
      let previewImageData = null;
      let toolBaseImageData = null;
      let activeTool = null;
      let isMatrixExpanded = true;
      let fftMode = "spectrum";
      let lastAppliedMode = null;
      let lastAppliedParams = null;
      let fftCache = null;
      let fftPreviewInfo = null;
      let fftPreviewRequestId = 0;
      let spatialFilterPreviewRequestId = 0;
      let pcaCache = null;
      let pcaPreviewInfo = null;
      let pcaPreviewRequestId = 0;
      let cannyPreviewInfo = null;
      let cannyPreviewRequestId = 0;
      let spatialFilterMode = "gaussian";
      let spatialFilterPreviewTimer = 0;
      let fftPreviewTimer = 0;
      let pcaPreviewTimer = 0;
      let cannyPreviewTimer = 0;
      let bcPreviewTimer = 0;
      let blendPreviewTimer = 0;
      let mosaicPreviewTimer = 0;
      let watermarkPreviewTimer = 0;
      let historyStack = [];
      let historyIndex = -1;
      let compareViewMode = "normal";
      let lastCompareBaseImageData = null;
      let controlDisabledSnapshot = null;
      let isProcessingLocked = false;
      let transientLoadingCount = 0;

      // GPU 單例：用於 gpu.js 運算，重複使用避免 Context 上限
      let globalGpu = null;

      function getGlobalGPU() {
        if (typeof window === "undefined") {
          return null;
        }
        // 若已確認失敗（被標記為 undefined），不再重試
        if (globalGpu === undefined) {
          return null;
        }
        if (globalGpu === null) {
          // gpu.js 載入後會暴露 window.GPU 工廠函式，
          // 改為直接偵測 gpu.js 而非 navigator.gpu（後者是 WebGPU API，與 gpu.js 無關）
          if (typeof window.GPU === "function") {
            try {
              globalGpu = new window.GPU();
            } catch (e) {
              console.warn("[GPU] 初始化失敗，將切換至 CPU 模式：", e.message || e);
              globalGpu = undefined;
              return null;
            }
          } else {
            globalGpu = undefined;
            return null;
          }
        }
        return globalGpu;
      }

      // Worker 孤兒清理：用於終止過時的 FFT / Canny Worker
      let activeFftWorker = null;
      let activeCannyWorker = null;

      // 畫布工具狀態
      let currentTool = "pan"; // 'pan' | 'probe' | 'zoom'
      let isMobile = false;

      // Canvas 平移 / 縮放狀態
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      let canvasScale = 1;
      let lastTouchDist = 0;

      // 繪圖狀態（Probe 不使用）

      const FFT_WORK_WIDTH = 256;
      const FFT_WORK_HEIGHT = 128;
      const PCA_LONG_EDGE = 64;
      const PCA_MIN_SHORT_EDGE = 32;
      const PCA_EIGEN_EPSILON = 1e-6;
      const MAX_HISTORY_STEPS = 10;
      const PREVIEW_DEBOUNCE_MS = 100;
      const CANNY_WEAK_EDGE_VALUE = 96;

      // ================================================================
      // INLINE WEB WORKER 工廠：避免 file:/// 協議的 CORS 限制
      // ================================================================
      function createInlineWorker(workerSource) {
        const blob = new Blob([workerSource], { type: "application/javascript" });
        const blobUrl = URL.createObjectURL(blob);
        const worker = new Worker(blobUrl);
        return {
          worker,
          terminate() {
            worker.terminate();
            URL.revokeObjectURL(blobUrl);
          }
        };
      }

      // Canny Edge Detection 演算法的 Worker 原始碼
      const CANNY_WORKER_SOURCE = `
        "use strict";

        function clamp(value, min, max) {
          return Math.min(max, Math.max(min, value));
        }

        function clampByte(value) {
          return Math.min(255, Math.max(0, Math.round(value)));
        }

        const CANNY_WEAK_EDGE = 96;

        function rgbaToLuma(r, g, b) {
          return 0.299 * r + 0.587 * g + 0.114 * b;
        }

        function buildCannyGaussianKernel(blurStrength) {
          const safeBlur = clamp(Math.round(blurStrength) || 3, 1, 5);
          const radius = safeBlur;
          const sigma = 0.65 + safeBlur * 0.45;
          const size = radius * 2 + 1;
          const kernel = new Float32Array(size);
          let sum = 0;

          for (let i = 0; i < size; i += 1) {
            const offset = i - radius;
            const weight = Math.exp(-(offset * offset) / (2 * sigma * sigma));
            kernel[i] = weight;
            sum += weight;
          }

          if (sum > 0) {
            for (let i = 0; i < size; i += 1) {
              kernel[i] /= sum;
            }
          }

          return { kernel, radius, sigma, size };
        }

        function applySeparableGaussianBlur(grayValues, width, height, kernelInfo) {
          const { kernel, radius } = kernelInfo;
          const horizontal = new Float32Array(grayValues.length);
          const output = new Float32Array(grayValues.length);

          for (let y = 0; y < height; y += 1) {
            const rowOffset = y * width;
            for (let x = 0; x < width; x += 1) {
              let sum = 0;
              for (let k = -radius; k <= radius; k += 1) {
                const sampleX = clamp(x + k, 0, width - 1);
                sum += grayValues[rowOffset + sampleX] * kernel[k + radius];
              }
              horizontal[rowOffset + x] = sum;
            }
          }

          for (let y = 0; y < height; y += 1) {
            const rowOffset = y * width;
            for (let x = 0; x < width; x += 1) {
              let sum = 0;
              for (let k = -radius; k <= radius; k += 1) {
                const sampleY = clamp(y + k, 0, height - 1);
                sum += horizontal[sampleY * width + x] * kernel[k + radius];
              }
              output[rowOffset + x] = sum;
            }
          }

          return output;
        }

        function computeSobelGradients(grayValues, width, height) {
          const magnitude = new Float32Array(grayValues.length);
          const direction = new Uint8Array(grayValues.length);

          for (let y = 1; y < height - 1; y += 1) {
            for (let x = 1; x < width - 1; x += 1) {
              const idx = y * width + x;
              const topLeft = grayValues[idx - width - 1];
              const top = grayValues[idx - width];
              const topRight = grayValues[idx - width + 1];
              const left = grayValues[idx - 1];
              const right = grayValues[idx + 1];
              const bottomLeft = grayValues[idx + width - 1];
              const bottom = grayValues[idx + width];
              const bottomRight = grayValues[idx + width + 1];

              const gradX =
                -topLeft - 2 * left - bottomLeft +
                topRight + 2 * right + bottomRight;
              const gradY =
                -topLeft - 2 * top - topRight +
                bottomLeft + 2 * bottom + bottomRight;
              const angle = ((Math.atan2(gradY, gradX) * 180) / Math.PI + 180) % 180;

              magnitude[idx] = Math.hypot(gradX, gradY);
              if (angle < 22.5 || angle >= 157.5) {
                direction[idx] = 0;
              } else if (angle < 67.5) {
                direction[idx] = 1;
              } else if (angle < 112.5) {
                direction[idx] = 2;
              } else {
                direction[idx] = 3;
              }
            }
          }

          return { magnitude, direction };
        }

        function applyNonMaximumSuppression(magnitude, direction, width, height) {
          const suppressed = new Float32Array(magnitude.length);

          for (let y = 1; y < height - 1; y += 1) {
            for (let x = 1; x < width - 1; x += 1) {
              const idx = y * width + x;
              const current = magnitude[idx];
              let neighborA = 0;
              let neighborB = 0;

              switch (direction[idx]) {
                case 0:
                  neighborA = magnitude[idx - 1];
                  neighborB = magnitude[idx + 1];
                  break;
                case 1:
                  neighborA = magnitude[idx - width - 1];
                  neighborB = magnitude[idx + width + 1];
                  break;
                case 2:
                  neighborA = magnitude[idx - width];
                  neighborB = magnitude[idx + width];
                  break;
                default:
                  neighborA = magnitude[idx - width + 1];
                  neighborB = magnitude[idx + width - 1];
                  break;
              }

              if (current >= neighborA && current >= neighborB) {
                suppressed[idx] = current;
              }
            }
          }

          return suppressed;
        }

        function normalizeMagnitudeBuffer(values) {
          let maxValue = 0;
          for (let i = 0; i < values.length; i += 1) {
            if (values[i] > maxValue) {
              maxValue = values[i];
            }
          }

          const normalized = new Uint8Array(values.length);
          if (maxValue <= 1e-6) {
            return { values: normalized, maxValue: 0 };
          }

          const scale = 255 / maxValue;
          for (let i = 0; i < values.length; i += 1) {
            normalized[i] = clampByte(values[i] * scale);
          }
          return { values: normalized, maxValue };
        }

        function applyDoubleThreshold(values, lowThreshold, highThreshold) {
          const classified = new Uint8Array(values.length);
          let strongCount = 0;

          for (let i = 0; i < values.length; i += 1) {
            const value = values[i];
            if (value >= highThreshold) {
              classified[i] = 255;
              strongCount += 1;
            } else if (value >= lowThreshold) {
              classified[i] = CANNY_WEAK_EDGE;
            }
          }

          return { classified, strongCount };
        }

        function trackEdgesByHysteresis(classified, width, height, initialStrongCount = 0) {
          const edgeMap = new Uint8Array(classified.length);
          const stack = new Uint32Array(classified.length);
          let stackSize = 0;
          let strongCount = 0;
          let linkedWeakCount = 0;

          for (let i = 0; i < classified.length; i += 1) {
            if (classified[i] === 255) {
              edgeMap[i] = 255;
              stack[stackSize] = i;
              stackSize += 1;
              strongCount += 1;
            }
          }

          while (stackSize > 0) {
            const idx = stack[stackSize - 1];
            stackSize -= 1;
            const x = idx % width;
            const y = Math.floor(idx / width);

            for (let dy = -1; dy <= 1; dy += 1) {
              const py = y + dy;
              if (py < 0 || py >= height) continue;
              for (let dx = -1; dx <= 1; dx += 1) {
                if (dx === 0 && dy === 0) continue;
                const px = x + dx;
                if (px < 0 || px >= width) continue;
                const neighborIndex = py * width + px;
                if (classified[neighborIndex] === CANNY_WEAK_EDGE && edgeMap[neighborIndex] === 0) {
                  edgeMap[neighborIndex] = 255;
                  stack[stackSize] = neighborIndex;
                  stackSize += 1;
                  linkedWeakCount += 1;
                }
              }
            }
          }

          return {
            edgeMap,
            strongEdgeCount: Math.max(strongCount, initialStrongCount),
            linkedWeakCount,
            edgePixelCount: Math.max(strongCount, initialStrongCount) + linkedWeakCount
          };
        }

        function binaryEdgeMapToImageData(edgeMap, width, height) {
          const output = new Uint8ClampedArray(width * height * 4);
          for (let i = 0, j = 0; j < edgeMap.length; i += 4, j += 1) {
            const value = edgeMap[j] ? 255 : 0;
            output[i] = value;
            output[i + 1] = value;
            output[i + 2] = value;
            output[i + 3] = 255;
          }
          return output;
        }

        function imageDataToGrayFloatBuffer(data, width, height) {
          const gray = new Float32Array(width * height);
          for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
            gray[j] = rgbaToLuma(data[i], data[i + 1], data[i + 2]);
          }
          return gray;
        }

        self.onmessage = function(e) {
          const { imageData, width, height, blurStrength, lowThreshold, highThreshold } = e.data;

          const normalizedLow = Math.min(lowThreshold, highThreshold - 1);
          const normalizedHigh = Math.max(highThreshold, normalizedLow + 1);

          // ── Hybrid Pipeline 雙軌邏輯 ────────────────────────────────────
          // 如果 GPU 已經完成了前處理，直接跳到 NMS 繼續執行
          if (e.data.magnitude && e.data.direction) {
            const { magnitude, direction } = e.data;
            const suppressed = applyNonMaximumSuppression(magnitude, direction, width, height);
            const normalized = normalizeMagnitudeBuffer(suppressed);
            const thresholded = applyDoubleThreshold(
              normalized.values,
              normalizedLow,
              normalizedHigh
            );
            const traced = trackEdgesByHysteresis(
              thresholded.classified,
              width,
              height,
              thresholded.strongCount
            );
            const resultData = binaryEdgeMapToImageData(traced.edgeMap, width, height);

            self.postMessage({
              resultData: Array.from(resultData),
              width,
              height,
              blurStrength,
              lowThreshold: normalizedLow,
              highThreshold: normalizedHigh,
              strongEdgeCount: traced.strongEdgeCount,
              linkedWeakCount: traced.linkedWeakCount,
              edgePixelCount: traced.edgePixelCount,
              kernelSize: 0,
              sigma: 0
            });
            return;
          }
          // ── Fallback：GPU 不可用時的全 CPU 流程 ──────────────────────
          const gray = imageDataToGrayFloatBuffer(imageData, width, height);
          const kernelInfo = buildCannyGaussianKernel(blurStrength);
          const blurred = applySeparableGaussianBlur(gray, width, height, kernelInfo);

          const { magnitude, direction } = computeSobelGradients(blurred, width, height);

          const suppressed = applyNonMaximumSuppression(magnitude, direction, width, height);
          const normalized = normalizeMagnitudeBuffer(suppressed);

          const thresholded = applyDoubleThreshold(
            normalized.values,
            normalizedLow,
            normalizedHigh
          );
          const traced = trackEdgesByHysteresis(
            thresholded.classified,
            width,
            height,
            thresholded.strongCount
          );

          const resultData = binaryEdgeMapToImageData(traced.edgeMap, width, height);

          self.postMessage(
            {
              resultData: Array.from(resultData),
              width,
              height,
              blurStrength,
              lowThreshold: normalizedLow,
              highThreshold: normalizedHigh,
              strongEdgeCount: traced.strongEdgeCount,
              linkedWeakCount: traced.linkedWeakCount,
              edgePixelCount: traced.edgePixelCount,
              kernelSize: kernelInfo.size,
              sigma: kernelInfo.sigma
            }
          );
        };
      `;

      // ================================================================
      // FFT WEB WORKER：執行離散傅立葉轉換的背景運算
      // ================================================================
      const FFT_WORKER_SOURCE = `
        "use strict";

        function clamp(value, min, max) {
          return Math.min(max, Math.max(min, value));
        }

        // 1D Cooley-Tukey FFT (in-place)
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

        // 2D FFT (row then column)
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

        // 頻譜對數資料計算
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
              const real = reRows[sourceY][sourceX];
              const imag = imRows[sourceY][sourceX];
              const value = Math.log1p(Math.hypot(real, imag));
              logMagnitude[rowOffset + sx] = value;
              if (value < minLog) minLog = value;
              if (value > maxLog) maxLog = value;
            }
          }

          return {
            width,
            height,
            logMagnitude: Array.from(logMagnitude),
            minLog: Number.isFinite(minLog) ? minLog : 0,
            maxLog
          };
        }

        // 頻譜影像資料計算（用於顯示）
        function buildSpectrumImageData(spectrumData, strengthValue) {
          const { width, height, logMagnitude, maxLog } = spectrumData;
          const normalizedStrength = clamp(strengthValue / 100, 0, 1);
          const output = new Float64Array(logMagnitude.length);

          if (maxLog < 1e-8) {
            output.fill(0);
            return Array.from(output);
          }

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

        // 頻率遮罩應用
        function applyFrequencyMask(reRows, imRows, mode, strengthValue) {
          const height = reRows.length;
          const width = reRows[0].length;
          const centerX = width / 2;
          const centerY = height / 2;
          const maxRadius = Math.hypot(centerX, centerY);
          const normalizedStrength = clamp(strengthValue / 100, 0, 1);
          const cutoffRadius =
            mode === "lowpass"
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
              const lowpassWeight =
                1 /
                (1 + Math.pow(distance / Math.max(1, cutoffRadius), butterworthOrder * 2));
              const weight = mode === "lowpass" ? lowpassWeight : 1 - lowpassWeight;
              reRows[sourceY][sourceX] *= weight;
              imRows[sourceY][sourceX] *= weight;
            }
          }
        }

        // 處理 FFT 工作（正向 FFT → 遮罩/頻譜 → 反向 FFT）
        function processFFT(grayBuffer, width, height, mode, strengthValue) {
          // 將灰階陣列轉換為 2D 實部陣列
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

          // 正向 2D FFT
          fft2dInPlace(reRows, imRows, false);

          // 建立頻譜資料
          const spectrumData = buildSpectrumLogData(reRows, imRows);

          // forward 模式：只做正向 FFT，回傳 rows 和 spectrumData
          if (mode === "forward") {
            return {
              type: "forward",
              reRows: reRows.map(row => Array.from(row)),
              imRows: imRows.map(row => Array.from(row)),
              spectrumData,
              width,
              height
            };
          }

          // 根據模式處理
          if (mode === "spectrum") {
            const spectrumImageData = buildSpectrumImageData(spectrumData, strengthValue);
            return {
              type: "spectrum",
              spectrumImageData,
              width,
              height,
              spectrumData
            };
          }

          // 低通/高通濾波
          const filteredRe = reRows.map((row) => Float64Array.from(row));
          const filteredIm = imRows.map((row) => Float64Array.from(row));
          applyFrequencyMask(filteredRe, filteredIm, mode, strengthValue);
          fft2dInPlace(filteredRe, filteredIm, true);

          // 收集空間域結果
          const spatial = new Float64Array(width * height);
          let index = 0;
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              spatial[index] = filteredRe[y][x];
              index += 1;
            }
          }

          // 混合原始灰階與處理後結果
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

          return {
            type: "filtered",
            outputData: Array.from(output),
            spectrumData,
            width,
            height
          };
        }

        self.onmessage = function(e) {
          const { grayBuffer, width, height, mode, strengthValue } = e.data;
          const result = processFFT(grayBuffer, width, height, mode, strengthValue);
          self.postMessage(result);
        };
      `;

      // 防抖工具：等待 ms 後執行，若期間再次觸發則重新計時
      function debounce(fn, delay) {
        let timer = 0;
        return function (...args) {
          clearTimeout(timer);
          timer = window.setTimeout(() => {
            fn.apply(this, args);
          }, delay);
        };
      }

      const DEMO_FUJI_IMAGE_URL = "./Fuji.png";
      const DEMO_FUJI_IMAGE_NAME = "Fuji.png";
      const DEMO_FUJI_FALLBACK_DATA_URL =
        typeof window !== "undefined" && typeof window.__FUJI_DEMO_DATA_URL === "string"
          ? window.__FUJI_DEMO_DATA_URL
          : "";

      const DEFAULT_A_INFO_HTML = [
        infoStat("檔名", "尚未上傳"),
        infoStat("用途", "載入 A 圖以啟用主畫布")
      ].join("");
      const DEFAULT_B_INFO_HTML = [
        infoStat("檔名", "尚未上傳"),
        infoStat("用途", "載入 B 圖以啟用雙圖混合")
      ].join("");

      const TOAST_LIMIT = 3;
      const TOAST_EXIT_MS = 280;
      const TOAST_TIMEOUTS = Object.freeze({
        ok: 2500,
        info: 3000,
        warn: 4000,
        error: 6000
      });
      const TOAST_ICONS = Object.freeze({
        ok: "check",
        warn: "warning",
        error: "close",
        info: "info"
      });

      function clampByte(value) {
        return Math.min(255, Math.max(0, Math.round(value)));
      }

      function cloneImageData(source) {
        return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
      }

      function getCenteredSelectedPoint(imageData) {
        if (!imageData) {
          return { x: 0, y: 0 };
        }
        return {
          x: Math.floor(imageData.width / 2),
          y: Math.floor(imageData.height / 2)
        };
      }

      function getBoundedImageSize(sourceWidth, sourceHeight, maxLongEdge = WORKSPACE_LONG_EDGE_LIMIT) {
        const safeWidth = Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : 1;
        const safeHeight = Number.isFinite(sourceHeight) && sourceHeight > 0 ? sourceHeight : 1;
        const longEdge = Math.max(safeWidth, safeHeight);
        const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
        return {
          width: Math.max(1, Math.round(safeWidth * scale)),
          height: Math.max(1, Math.round(safeHeight * scale))
        };
      }

      function getContainRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
        const safeSourceWidth = Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : 1;
        const safeSourceHeight = Number.isFinite(sourceHeight) && sourceHeight > 0 ? sourceHeight : 1;
        const safeTargetWidth = Number.isFinite(targetWidth) && targetWidth > 0 ? targetWidth : 1;
        const safeTargetHeight = Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight : 1;
        const scale = Math.min(safeTargetWidth / safeSourceWidth, safeTargetHeight / safeSourceHeight);
        const width = Math.max(1, Math.round(safeSourceWidth * scale));
        const height = Math.max(1, Math.round(safeSourceHeight * scale));
        return {
          x: Math.floor((safeTargetWidth - width) / 2),
          y: Math.floor((safeTargetHeight - height) / 2),
          width,
          height
        };
      }

      function getCanvasRenderBox(imageData, canvasWidth, canvasHeight) {
        if (!imageData) {
          return null;
        }
        return getContainRect(
          imageData.width,
          imageData.height,
          canvasWidth,
          canvasHeight
        );
      }

      function getMainCanvasRenderBox(imageData) {
        return getCanvasRenderBox(imageData, DISPLAY_CANVAS_WIDTH, DISPLAY_CANVAS_HEIGHT);
      }

      function imageDataToCanvas(imageData) {
        const bufferCtx = createCanvasContext(imageData.width, imageData.height, { willReadFrequently: true });
        bufferCtx.putImageData(imageData, 0, 0);
        return bufferCtx.canvas;
      }

      function clearCanvasSurface(canvas, context) {
        if (!canvas || !context) {
          return;
        }
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "rgba(6, 12, 33, 0.98)";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      function drawImageDataToSurface(imageData, canvas, context) {
        clearCanvasSurface(canvas, context);
        if (!imageData || !canvas || !context) {
          return null;
        }
        const renderBox = getCanvasRenderBox(imageData, canvas.width, canvas.height);
        if (!renderBox) {
          return null;
        }
        const bufferCanvas = imageDataToCanvas(imageData);
        context.drawImage(bufferCanvas, renderBox.x, renderBox.y, renderBox.width, renderBox.height);
        return renderBox;
      }

      function cloneAnalysisPreviewInfo(toolName) {
        if (toolName === "fft" && fftPreviewInfo) {
          return {
            resultImageData: cloneImageData(fftPreviewInfo.resultImageData),
            mode: fftPreviewInfo.mode,
            strength: fftPreviewInfo.strength
          };
        }
        if (toolName === "pca" && pcaPreviewInfo) {
          return {
            resultImageData: cloneImageData(pcaPreviewInfo.resultImageData),
            latentImageData: cloneImageData(pcaPreviewInfo.latentImageData),
            compressionRatio: pcaPreviewInfo.compressionRatio,
            infoRetention: pcaPreviewInfo.infoRetention,
            retentionPercent: pcaPreviewInfo.retentionPercent,
            componentCount: pcaPreviewInfo.componentCount
          };
        }
        if (toolName === "canny" && cannyPreviewInfo) {
          return {
            resultImageData: cloneImageData(cannyPreviewInfo.resultImageData),
            blurStrength: cannyPreviewInfo.blurStrength,
            lowThreshold: cannyPreviewInfo.lowThreshold,
            highThreshold: cannyPreviewInfo.highThreshold,
            strongEdgeCount: cannyPreviewInfo.strongEdgeCount,
            linkedWeakCount: cannyPreviewInfo.linkedWeakCount,
            edgePixelCount: cannyPreviewInfo.edgePixelCount,
            edgeDensity: cannyPreviewInfo.edgeDensity,
            kernelSize: cannyPreviewInfo.kernelSize,
            sigma: cannyPreviewInfo.sigma
          };
        }
        return null;
      }

      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      function yieldToBrowser() {
        return new Promise((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }

      function createCanvasContext(width, height, options = {}) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas.getContext("2d", { willReadFrequently: Boolean(options.willReadFrequently) });
      }

      function rgbaToLuma(r, g, b) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
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
        const result = targetCtx.getImageData(0, 0, targetWidth, targetHeight);
        targetCtx.canvas.width = 0;
        targetCtx.canvas.height = 0;
        return result;
      }

      function imageDataToGrayBuffer(sourceImageData, targetWidth, targetHeight) {
        const resized = resampleImageData(sourceImageData, targetWidth, targetHeight, { smoothing: true });
        const gray = new Float64Array(targetWidth * targetHeight);
        const d = resized.data;
        for (let i = 0, j = 0; i < d.length; i += CHANNELS, j += 1) {
          gray[j] = rgbaToLuma(d[i], d[i + 1], d[i + 2]);
        }
        return gray;
      }

      function grayBufferToImageData(grayValues, width, height) {
        const output = new ImageData(width, height);
        const d = output.data;
        for (let i = 0, j = 0; j < grayValues.length; i += CHANNELS, j += 1) {
          const value = clampByte(grayValues[j]);
          d[i] = value;
          d[i + 1] = value;
          d[i + 2] = value;
          d[i + 3] = 255;
        }
        return output;
      }

      function grayBufferToNormalizedImageData(values, width, height) {
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < values.length; i += 1) {
          const value = values[i];
          if (value < min) min = value;
          if (value > max) max = value;
        }

        const span = max - min;
        const output = new Float64Array(values.length);
        if (!Number.isFinite(span) || span < 1e-8) {
          output.fill(128);
        } else {
          for (let i = 0; i < values.length; i += 1) {
            output[i] = ((values[i] - min) / span) * 255;
          }
        }
        return grayBufferToImageData(output, width, height);
      }

      function scaleImageDataToSize(sourceImageData, width, height, options = {}) {
        return resampleImageData(sourceImageData, width, height, options);
      }

      function grayBufferToCanvasSizedImageData(
        grayValues,
        sourceWidth,
        sourceHeight,
        targetWidth = sourceWidth,
        targetHeight = sourceHeight
      ) {
        const workImage = grayBufferToImageData(grayValues, sourceWidth, sourceHeight);
        return scaleImageDataToSize(workImage, targetWidth, targetHeight, { smoothing: true });
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
        const landscape = sourceWidth >= sourceHeight;
        const longSide = PCA_LONG_EDGE;
        if (landscape) {
          const shortSide = Math.max(
            PCA_MIN_SHORT_EDGE,
            Math.round((sourceHeight / sourceWidth) * longSide)
          );
          return { width: longSide, height: shortSide };
        }
        const shortSide = Math.max(
          PCA_MIN_SHORT_EDGE,
          Math.round((sourceWidth / sourceHeight) * longSide)
        );
        return { width: shortSide, height: longSide };
      }

      function formatRatio(value) {
        if (!Number.isFinite(value) || value <= 0) {
          return "--";
        }
        return `${value.toFixed(value >= 10 ? 1 : 2)}x`;
      }

      function formatPercent(value) {
        if (!Number.isFinite(value)) {
          return "--";
        }
        return `${(value * 100).toFixed(1)}%`;
      }

      function resolvePreviewOption(option, built, fallback = "") {
        if (typeof option === "function") {
          const resolved = option(built);
          return resolved == null || resolved === false ? fallback : resolved;
        }
        if (option == null || option === "") {
          return fallback;
        }
        return option;
      }

      function resolvePreviewToast(toastOption, built, fallbackTitle, fallbackMessage, fallbackType = "info") {
        if (!toastOption) {
          return null;
        }
        const resolved = typeof toastOption === "function" ? toastOption(built) : toastOption;
        if (!resolved) {
          return null;
        }
        return {
          type: resolved.type || fallbackType,
          title: resolved.title || fallbackTitle,
          message: resolved.message || fallbackMessage,
          timeout: resolved.timeout,
          persistent: Boolean(resolved.persistent)
        };
      }

      function clearFFTAnalysisState() {
        fftCache = null;
        fftPreviewInfo = null;
        fftPreviewRequestId += 1;
      }

      function clearPCAAnalysisState() {
        pcaCache = null;
        pcaPreviewInfo = null;
        pcaPreviewRequestId += 1;
      }

      function clearCannyAnalysisState() {
        cannyPreviewInfo = null;
        cannyPreviewRequestId += 1;
      }

      function clearAdvancedAnalysisState() {
        clearFFTAnalysisState();
        clearPCAAnalysisState();
        clearCannyAnalysisState();
      }

      function clearDeferredPreviewJobs(exceptTool = null) {
        if (exceptTool !== "spatialFilter" && spatialFilterPreviewTimer) {
          clearTimeout(spatialFilterPreviewTimer);
          spatialFilterPreviewTimer = 0;
        }
        if (exceptTool !== "fft" && fftPreviewTimer) {
          clearTimeout(fftPreviewTimer);
          fftPreviewTimer = 0;
        }
        if (exceptTool !== "pca" && pcaPreviewTimer) {
          clearTimeout(pcaPreviewTimer);
          pcaPreviewTimer = 0;
        }
        if (exceptTool !== "canny" && cannyPreviewTimer) {
          clearTimeout(cannyPreviewTimer);
          cannyPreviewTimer = 0;
        }
      }

      function setTransientLoading(isLoading, text = "預覽計算中...") {
        if (isLoading) {
          transientLoadingCount += 1;
          if (!isProcessingLocked) {
            loadingBadge.textContent = text;
            loadingBadge.classList.add("show");
          }
          return;
        }

        transientLoadingCount = Math.max(0, transientLoadingCount - 1);
        if (!isProcessingLocked && transientLoadingCount === 0) {
          loadingBadge.classList.remove("show");
        }
      }

      function resetCompareState(options = {}) {
        lastCompareBaseImageData = null;
        if (!options.preserveMode) {
          compareViewMode = "normal";
        }
      }

      function captureCompareBaseImage(imageData) {
        lastCompareBaseImageData = imageData ? cloneImageData(imageData) : null;
      }

      function resetHistory(imageData, label = "初始化") {
        historyStack = [];
        historyIndex = -1;
        if (imageData) {
          historyStack.push({
            label,
            imageData: cloneImageData(imageData)
          });
          historyIndex = 0;
        }
        updateHistoryControls();
      }

      function pushHistoryState(label, imageData) {
        if (!imageData) {
          updateHistoryControls();
          return;
        }

        if (historyIndex < historyStack.length - 1) {
          historyStack = historyStack.slice(0, historyIndex + 1);
        }

        historyStack.push({
          label,
          imageData: cloneImageData(imageData)
        });

        while (historyStack.length > MAX_HISTORY_STEPS) {
          historyStack.shift();
        }

        historyIndex = historyStack.length - 1;
        updateHistoryControls();
      }

      function updateHistoryControls() {
        const total = historyStack.length;
        const current = total > 0 && historyIndex >= 0 ? historyIndex + 1 : 0;
        if (historyBadge) {
          historyBadge.textContent = `歷史 ${current} / ${total}`;
        }
        if (undoBtn && !isProcessingLocked) {
          // 圖像未載入（無 history）或已經在最初狀態時禁用
          undoBtn.disabled = !currentImageData || historyStack.length <= 1 || historyIndex <= 0;
        }
        if (redoBtn && !isProcessingLocked) {
          // 圖像未載入、history 為空、或已經在最末端狀態時禁用
          redoBtn.disabled = !currentImageData || historyStack.length <= 1 || historyIndex >= historyStack.length - 1;
        }
      }

      function applyHistoryState(nextIndex, successMessage, emptyMessage, toast) {
        if (!currentImageData || historyStack.length === 0) {
          notifyStatus(emptyMessage, "warn", toast);
          return false;
        }
        if (nextIndex < 0 || nextIndex >= historyStack.length) {
          notifyStatus(emptyMessage, "warn", toast);
          return false;
        }

        const compareBase =
          currentImageData && historyIndex >= 0 ? cloneImageData(currentImageData) : null;
        historyIndex = nextIndex;
        clearPreviewState();
        currentImageData = cloneImageData(historyStack[historyIndex].imageData);
        captureCompareBaseImage(compareBase);
        refreshCanvasView();
        refreshMatrixView();
        notifyStatus(successMessage, "ok", toast);
        updateHistoryControls();
        return true;
      }

      function undoHistory() {
        if (!requireCommittedState("回到上一步", { toast: true })) return false;
        if (historyIndex <= 0) {
          notifyStatus("沒有更多可回復狀態。", "warn", {
            title: "無法再往前",
            message: "目前已經是最早的已套用狀態。"
          });
          return false;
        }
        const nextLabel = historyStack[historyIndex - 1]?.label || "前一個狀態";
        return applyHistoryState(
          historyIndex - 1,
          `已回到上一步（${nextLabel}）。`,
          "沒有更多可回復狀態。",
          {
            title: "已回到上一步",
            message: `目前已切換到「${nextLabel}」狀態。`
          }
        );
      }

      function redoHistory() {
        if (!requireCommittedState("前進到下一步", { toast: true })) return false;
        if (historyIndex < 0 || historyIndex >= historyStack.length - 1) {
          notifyStatus("沒有更多可前進狀態。", "warn", {
            title: "無法再往後",
            message: "目前已經是最新的已套用狀態。"
          });
          return false;
        }
        const nextLabel = historyStack[historyIndex + 1]?.label || "下一個狀態";
        return applyHistoryState(
          historyIndex + 1,
          `已前進到下一步（${nextLabel}）。`,
          "沒有更多可前進狀態。",
          {
            title: "已前進到下一步",
            message: `目前已切換到「${nextLabel}」狀態。`
          }
        );
      }

      function updatePCAMetrics(info = null) {
        if (pcaCompressionRatio) {
          pcaCompressionRatio.textContent = info ? formatRatio(info.compressionRatio) : "--";
        }
        if (pcaInfoRetention) {
          pcaInfoRetention.textContent = info ? formatPercent(info.infoRetention) : "--";
        }
      }

      function updateCannyMetrics(info = null) {
        if (cannyEdgeCount) {
          cannyEdgeCount.textContent =
            info && Number.isFinite(info.edgePixelCount)
              ? info.edgePixelCount.toLocaleString()
              : "--";
        }
        if (cannyWeakLinkCount) {
          cannyWeakLinkCount.textContent =
            info && Number.isFinite(info.linkedWeakCount)
              ? info.linkedWeakCount.toLocaleString()
              : "--";
        }
        if (cannyEdgeDensity) {
          cannyEdgeDensity.textContent =
            info && Number.isFinite(info.edgeDensity)
              ? formatPercent(info.edgeDensity)
              : "--";
        }
      }

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => {
          if (char === "&") return "&amp;";
          if (char === "<") return "&lt;";
          if (char === ">") return "&gt;";
          if (char === '"') return "&quot;";
          return "&#39;";
        });
      }

      function infoStat(label, value) {
        return [
          '<div class="info-stat">',
          `<span class="info-label">${escapeHtml(label)}</span>`,
          `<span class="info-value">${escapeHtml(value)}</span>`,
          "</div>"
        ].join("");
      }

      function normalizeToastType(type) {
        return Object.prototype.hasOwnProperty.call(TOAST_TIMEOUTS, type) ? type : "info";
      }

      function dismissToast(toastEl) {
        if (!toastEl || toastEl.dataset.state === "closing") {
          return;
        }

        toastEl.dataset.state = "closing";
        toastEl.classList.remove("is-visible");
        toastEl.classList.add("is-closing");

        if (toastEl._closeTimer) {
          clearTimeout(toastEl._closeTimer);
          toastEl._closeTimer = 0;
        }

        if (toastEl._removeTimer) {
          clearTimeout(toastEl._removeTimer);
        }

        toastEl._removeTimer = window.setTimeout(() => {
          toastEl.remove();
        }, TOAST_EXIT_MS);
      }

      function showToast({ type = "info", title = "", message = "", timeout, persistent = false } = {}) {
        if (!toastHost) {
          return {
            close() {}
          };
        }

        const resolvedType = normalizeToastType(type);
        const resolvedTimeout = Number.isFinite(timeout) ? Math.max(0, timeout) : TOAST_TIMEOUTS[resolvedType];
        const activeToasts = Array.from(toastHost.children).filter((node) => node.dataset.state !== "closing");

        while (activeToasts.length >= TOAST_LIMIT) {
          dismissToast(activeToasts.shift());
        }

        const toastEl = document.createElement("section");
        toastEl.className = `toast toast--${resolvedType}${persistent ? " toast--persistent" : ""}`;
        toastEl.dataset.state = "open";
        toastEl.style.setProperty("--toast-time", `${resolvedTimeout}ms`);
        toastEl.setAttribute("role", resolvedType === "error" ? "alert" : "status");

        const stripe = document.createElement("span");
        stripe.className = "toast__stripe";
        stripe.setAttribute("aria-hidden", "true");

        const body = document.createElement("div");
        body.className = "toast__body";

        const iconWrap = document.createElement("div");
        iconWrap.className = "toast__icon";
        iconWrap.setAttribute("aria-hidden", "true");
        const icon = document.createElement("span");
        icon.className = "material-symbols-rounded";
        icon.textContent = TOAST_ICONS[resolvedType];
        iconWrap.appendChild(icon);

        const copy = document.createElement("div");
        copy.className = "toast__copy";
        const titleEl = document.createElement("p");
        titleEl.className = "toast__title";
        titleEl.textContent = title || "系統提示";
        const messageEl = document.createElement("p");
        messageEl.className = "toast__message";
        messageEl.textContent = message || "";
        copy.appendChild(titleEl);
        copy.appendChild(messageEl);

        const closeBtn = document.createElement("button");
        closeBtn.className = "toast__close";
        closeBtn.type = "button";
        closeBtn.setAttribute("aria-label", "關閉提示");
        closeBtn.textContent = "×";
        closeBtn.addEventListener("click", () => dismissToast(toastEl));

        const progress = document.createElement("div");
        progress.className = "toast__progress";
        progress.setAttribute("aria-hidden", "true");
        const progressBar = document.createElement("span");
        progressBar.className = "toast__progress-bar";
        progress.appendChild(progressBar);

        body.appendChild(iconWrap);
        body.appendChild(copy);
        body.appendChild(closeBtn);
        toastEl.appendChild(stripe);
        toastEl.appendChild(body);
        toastEl.appendChild(progress);
        toastHost.appendChild(toastEl);

        window.requestAnimationFrame(() => {
          toastEl.classList.add("is-visible");
        });

        if (!persistent && resolvedTimeout > 0) {
          toastEl._closeTimer = window.setTimeout(() => {
            dismissToast(toastEl);
          }, resolvedTimeout);
        }

        return {
          close() {
            dismissToast(toastEl);
          }
        };
      }

      function notifyStatus(message, type = "ok", toast = null) {
        setStatus(message, type);

        if (!toast) {
          return;
        }

        showToast({
          type: toast.type || type,
          title:
            toast.title ||
            (type === "error" ? "處理失敗" : type === "warn" ? "注意" : type === "ok" ? "操作成功" : "處理中"),
          message: toast.message || message,
          timeout: toast.timeout,
          persistent: toast.persistent
        });
      }

      function setStatus(message, type = "ok") {
        statusText.textContent = message;
        statusText.classList.remove("warn", "error", "ok", "info");
        statusText.classList.add(type);
      }

      function setProcessing(isProcessing, text = "處理中...") {
        isProcessingLocked = isProcessing;
        loadingBadge.textContent = text;
        loadingBadge.classList.toggle("show", isProcessing || transientLoadingCount > 0);
        const lockTargets = document.querySelectorAll("button, input, select, textarea");
        if (isProcessing) {
          controlDisabledSnapshot = new Map();
          lockTargets.forEach((el) => {
            if (el.id === "fileInputA" || el.id === "fileInputB") {
              return;
            }
            if ("disabled" in el) {
              controlDisabledSnapshot.set(el, el.disabled);
              el.disabled = true;
            }
          });
          return;
        }

        if (controlDisabledSnapshot) {
          controlDisabledSnapshot.forEach((wasDisabled, el) => {
            if (el && "disabled" in el) {
              el.disabled = wasDisabled;
            }
          });
          controlDisabledSnapshot = null;
        }
        updateWorkspaceControls();
      }

      async function withProcessing(text, task, toast = null) {
        const processingToast =
          toast &&
          showToast({
            type: "info",
            title: toast.title || "處理中",
            message: toast.message || text,
            timeout: toast.timeout,
            persistent: true
          });
        setProcessing(true, text);
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        try {
          await task();
        } finally {
          setProcessing(false);
          if (processingToast) {
            processingToast.close();
          }
        }
      }

      function ensureImageLoaded(options = {}) {
        if (!currentImageData) {
          const statusMessage = options.message || "尚未載入主圖 A，請先上傳圖片。";
          const toastTitle = options.toastTitle || "尚未載入圖片";
          const toastMessage = options.toastMessage || "請先上傳圖片（A）。";
          notifyStatus(
            statusMessage,
            "warn",
            options.toast
              ? {
                  title: toastTitle,
                  message: toastMessage
                }
              : null
          );
          return false;
        }
        return true;
      }

      function modeLabel(mode) {
        if (mode === "r") return "R";
        if (mode === "g") return "G";
        if (mode === "b") return "B";
        return "RGB";
      }

      function toolLabel(toolName) {
        if (toolName === "brightnessContrast") return "亮度/對比";
        if (toolName === "blend") return "混合";
        if (toolName === "mosaic") return "馬賽克";
        if (toolName === "watermark") return "水印";
        if (toolName === "fft") return "FFT";
        if (toolName === "pca") return "PCA";
        if (toolName === "canny") return "Canny 邊緣偵測";
        if (toolName === "spatialFilter") return "空間濾鏡";
        return "效果";
      }

      function hasPendingPreview() {
        return Boolean(previewImageData);
      }

      function getPrimaryWorkspaceImage() {
        return currentImageData || originalImageData;
      }

      function getCompareBaseImageData() {
        if (hasPendingPreview() && toolBaseImageData) {
          return toolBaseImageData;
        }
        if (lastCompareBaseImageData) {
          return lastCompareBaseImageData;
        }
        if (originalImageData) {
          return originalImageData;
        }
        return currentImageData;
      }

      function getCompareViewState() {
        const afterImageData = getRenderableImageData();
        const beforeImageData = getCompareBaseImageData() || afterImageData;
        let beforeLabel = "目前結果";

        if (hasPendingPreview() && toolBaseImageData) {
          beforeLabel = `${toolLabel(activeTool)}基底`;
        } else if (lastCompareBaseImageData) {
          beforeLabel = "最近一次套用前";
        } else if (originalImageData) {
          beforeLabel = "原始 A 圖";
        }

        return {
          beforeImageData,
          afterImageData,
          beforeLabel,
          afterLabel: hasPendingPreview() ? "預覽結果" : "目前結果",
          hasRenderable: Boolean(afterImageData),
          isSplit: compareViewMode === "split" && Boolean(beforeImageData && afterImageData)
        };
      }

      function updateCompareControls() {
        const compareState = getCompareViewState();
        if (!compareState.hasRenderable && compareViewMode === "split") {
          compareViewMode = "normal";
        }
        const isCompareOpen = compareViewMode === "split" && compareState.hasRenderable;
        if (compareViewBtn && !isProcessingLocked) {
          compareViewBtn.disabled = !compareState.hasRenderable;
          compareViewBtn.classList.toggle("active", isCompareOpen);
          compareViewBtn.setAttribute("aria-pressed", String(isCompareOpen));
        }
        if (compareBeforeLabel) {
          compareBeforeLabel.textContent = compareState.beforeLabel;
        }
        if (compareAfterLabel) {
          compareAfterLabel.textContent = compareState.afterLabel;
        }
        renderCompareModal({
          ...compareState,
          isSplit: isCompareOpen
        });
      }

      function setCompareModalVisibility(visible) {
        if (!compareModal) {
          return;
        }
        compareModal.hidden = !visible;
        compareModal.classList.toggle("is-visible", visible);
        compareModal.setAttribute("aria-hidden", String(!visible));
        document.body.classList.toggle("compare-modal-open", visible);
      }

      function writeCompareModalMatrix(target, value) {
        if (target) {
          target.textContent = value;
        }
      }

      function updateCompareModalMatrixPanel(targets, sample) {
        if (!targets) {
          return;
        }
        if (!sample) {
          if (targets.rgb) {
            targets.rgb.textContent = "(-, -, -)";
          }
          writeCompareModalMatrix(targets.r, "");
          writeCompareModalMatrix(targets.g, "");
          writeCompareModalMatrix(targets.b, "");
          return;
        }

        if (targets.rgb) {
          targets.rgb.textContent = sample.centerText;
        }
        writeCompareModalMatrix(targets.r, sample.rText);
        writeCompareModalMatrix(targets.g, sample.gText);
        writeCompareModalMatrix(targets.b, sample.bText);
      }

      function renderCompareModalMatrices(compareState = getCompareViewState()) {
        const beforeSample = buildMatrixSample(compareState.beforeImageData);
        const afterSample = buildMatrixSample(compareState.afterImageData);
        updateCompareModalMatrixPanel(
          {
            rgb: compareBeforeRgb,
            r: compareBeforeMatrixR,
            g: compareBeforeMatrixG,
            b: compareBeforeMatrixB
          },
          beforeSample
        );
        updateCompareModalMatrixPanel(
          {
            rgb: compareAfterRgb,
            r: compareAfterMatrixR,
            g: compareAfterMatrixG,
            b: compareAfterMatrixB
          },
          afterSample
        );
        const activeSample = afterSample || beforeSample;
        if (compareModalPointText) {
          compareModalPointText.textContent = activeSample ? activeSample.pointText : "(-, -)";
        }
        if (compareModalSampleText) {
          compareModalSampleText.textContent = `N = ${sampleSizeN}`;
        }

        if (beforeSample && afterSample) {
          const inputPixel = [beforeSample.centerR, beforeSample.centerG, beforeSample.centerB];
          const outputPixel = [afterSample.centerR, afterSample.centerG, afterSample.centerB];
          updateMathBridge(lastAppliedMode, lastAppliedParams, inputPixel, outputPixel);
        } else {
          updateMathBridge(lastAppliedMode, lastAppliedParams, null, null);
        }
      }

      function updateMathBridge(mode, params, inputPixel, outputPixel) {
        const el = mathBridgeContent;
        if (!el) return;

        let html = '<span class="bridge-idle">尚無套用操作，無需解析。</span>';

        if (!mode || !params) {
          el.innerHTML = html;
          return;
        }

        const [iR, iG, iB] = inputPixel ?? [0, 0, 0];
        const [oR, oG, oB] = outputPixel ?? [0, 0, 0];

        switch (mode) {
          case "BC_ADJUST": {
            const b = params.brightness ?? 0;
            const c = params.contrast ?? 1;
            const mid = 128;
            const s1r = iR - mid, s1g = iG - mid, s1b = iB - mid;
            const s2r = s1r * c, s2g = s1g * c, s2b = s1b * c;
            const s3r = s2r + mid + b, s3g = s2g + mid + b, s3b = s2b + mid + b;
            const cr = Math.max(0, Math.min(255, Math.round(s3r)));
            const cg = Math.max(0, Math.min(255, Math.round(s3g)));
            const cb = Math.max(0, Math.min(255, Math.round(s3b)));
            html = `
<details class="bridge-collapse" open>
  <summary class="bridge-collapse__summary">① 減去中值：P − ${mid}</summary>
  <div class="bridge-collapse__body">
    <span class="bridge-step bridge-channel-r">R: <span class="bridge-number">${iR}</span><span class="bridge-arrow">−</span><span class="bridge-number">${mid}</span><span class="bridge-arrow">=</span><span class="bridge-number">${s1r}</span></span>
    <span class="bridge-step bridge-channel-g">G: <span class="bridge-number">${iG}</span><span class="bridge-arrow">−</span><span class="bridge-number">${mid}</span><span class="bridge-arrow">=</span><span class="bridge-number">${s1g}</span></span>
    <span class="bridge-step bridge-channel-b">B: <span class="bridge-number">${iB}</span><span class="bridge-arrow">−</span><span class="bridge-number">${mid}</span><span class="bridge-arrow">=</span><span class="bridge-number">${s1b}</span></span>
  </div>
</details>
<details class="bridge-collapse">
  <summary class="bridge-collapse__summary">② 對比縮放：× ${c.toFixed(2)}</summary>
  <div class="bridge-collapse__body">
    <span class="bridge-step bridge-channel-r">R: <span class="bridge-number">${s1r}</span><span class="bridge-arrow">→</span><span class="bridge-number">${s2r.toFixed(1)}</span></span>
    <span class="bridge-step bridge-channel-g">G: <span class="bridge-number">${s1g}</span><span class="bridge-arrow">→</span><span class="bridge-number">${s2g.toFixed(1)}</span></span>
    <span class="bridge-step bridge-channel-b">B: <span class="bridge-number">${s1b}</span><span class="bridge-arrow">→</span><span class="bridge-number">${s2b.toFixed(1)}</span></span>
  </div>
</details>
<details class="bridge-collapse">
  <summary class="bridge-collapse__summary">③ 加入亮度：+ ${b}</summary>
  <div class="bridge-collapse__body">
    <span class="bridge-step bridge-channel-r">R: <span class="bridge-number">${s2r.toFixed(1)}</span><span class="bridge-arrow">→</span><span class="bridge-number">${s3r.toFixed(1)}</span></span>
    <span class="bridge-step bridge-channel-g">G: <span class="bridge-number">${s2g.toFixed(1)}</span><span class="bridge-arrow">→</span><span class="bridge-number">${s3g.toFixed(1)}</span></span>
    <span class="bridge-step bridge-channel-b">B: <span class="bridge-number">${s2b.toFixed(1)}</span><span class="bridge-arrow">→</span><span class="bridge-number">${s3b.toFixed(1)}</span></span>
  </div>
</details>
<span class="bridge-result"><span class="bridge-result-label">最終輸出</span><span class="bridge-number">R=${cr}  G=${cg}  B=${cb}</span></span>`;
            break;
          }

          case "GRAYSCALE": {
            const y = Math.round(0.299 * iR + 0.587 * iG + 0.114 * iB);
            html = `
<span class="bridge-step"><span class="bridge-step-label">公式</span>Y = 0.299·R + 0.587·G + 0.114·B</span>
<span class="bridge-step"><span class="bridge-step-label">原始</span><span class="bridge-number">(${iR}, ${iG}, ${iB})</span></span>
<span class="bridge-step"><span class="bridge-step-label">計算</span><span class="bridge-number">${(0.299 * iR).toFixed(1)}</span><span class="bridge-arrow">+</span><span class="bridge-number">${(0.587 * iG).toFixed(1)}</span><span class="bridge-arrow">+</span><span class="bridge-number">${(0.114 * iB).toFixed(1)}</span><span class="bridge-arrow">=</span><span class="bridge-number">${y}</span></span>
<span class="bridge-result"><span class="bridge-result-label">輸出</span><span class="bridge-number">R=G=B=${y}</span></span>`;
            break;
          }

          case "SPATIAL": {
            const kType = params.filterMode ?? "gaussian";
            const kSize = kType === "gaussian" ? (params.kernelSize ?? 5) : 3;
            const kernels = {
              gaussian: { label: "高斯模糊", matrix: "1/16×[[1,2,1],[2,4,2],[1,2,1]]" },
              sharpen: { label: "銳化", matrix: "[[0,−1,0],[−1,5,−1],[0,−1,0]]" },
              edge: { label: "邊緣偵測", matrix: "[[−1,−1,−1],[−1,8,−1],[−1,−1,−1]]" },
            };
            const { label: kLabel, matrix: kMatrix } = kernels[kType] || kernels.gaussian;
            html = `
<span class="bridge-step"><span class="bridge-step-label">卷積核</span>${kSize}×${kSize} — ${kLabel}</span>
<span class="bridge-kernel">${kMatrix}</span>
<span class="bridge-step"><span class="bridge-step-label">中心像素</span><span class="bridge-number">(${iR}, ${iG}, ${iB})</span></span>
<span class="bridge-step"><span class="bridge-step-label">套用核</span>掃描全圖，周圍加權求和</span>
<span class="bridge-result"><span class="bridge-result-label">結果</span><span class="bridge-number">(${oR}, ${oG}, ${oB})</span></span>`;
            break;
          }

          case "BLEND": {
            const alpha = params.alpha ?? 0.5;
            const w = 1 - alpha;
            html = `
<span class="bridge-step"><span class="bridge-step-label">混合公式</span>Out = α·A + (1−α)·B</span>
<span class="bridge-step"><span class="bridge-step-label">α = ${alpha.toFixed(2)}</span>A: <span class="bridge-number">(${iR}, ${iG}, ${iB})</span></span>
<span class="bridge-step"><span class="bridge-step-label">B 圖</span><span class="bridge-number">(${oR}, ${oG}, ${oB})</span></span>
<span class="bridge-step"><span class="bridge-step-label">R 運算</span><span class="bridge-number">${alpha.toFixed(2)}</span><span class="bridge-arrow">×</span><span class="bridge-number">${iR}</span><span class="bridge-arrow">+</span><span class="bridge-number">${w.toFixed(2)}</span><span class="bridge-arrow">×</span><span class="bridge-number">${oR}</span><span class="bridge-arrow">=</span><span class="bridge-number">${Math.round(alpha * iR + w * oR)}</span></span>
<span class="bridge-result"><span class="bridge-result-label">輸出</span><span class="bridge-number">(${Math.round(alpha * iR + w * oR)}, ${Math.round(alpha * iG + w * oG)}, ${Math.round(alpha * iB + w * oB)})</span></span>`;
            break;
          }

          case "MOSAIC": {
            const bs = params.blockSize ?? 10;
            html = `
<span class="bridge-step"><span class="bridge-step-label">區塊大小</span>${bs}×${bs} 像素</span>
<span class="bridge-step"><span class="bridge-step-label">中心像素</span><span class="bridge-number">(${iR}, ${iG}, ${iB})</span></span>
<span class="bridge-step"><span class="bridge-step-label">計算</span>取該區塊所有像素的平均 RGB</span>
<span class="bridge-result"><span class="bridge-result-label">輸出</span><span class="bridge-number">(${oR}, ${oG}, ${oB})</span></span>`;
            break;
          }

          case "FFT": {
            const fMode = params.fftMode ?? "spectrum";
            const strength = params.fftStrength ?? 45;
            const modeDesc = {
              spectrum: "頻譜映射",
              lowpass: "低通保留結構",
              highpass: "高通保留輪廓",
            };
            html = `
<span class="bridge-step"><span class="bridge-step-label">FFT 模式</span>${fMode} — ${modeDesc[fMode] ?? fMode}</span>
<span class="bridge-step"><span class="bridge-step-label">強度</span><span class="bridge-number">${strength}</span></span>
<span class="bridge-step"><span class="bridge-step-label">① FFT</span>空間域 → 頻率域</span>
<span class="bridge-step"><span class="bridge-step-label">② 濾波</span>${modeDesc[fMode] ?? ""}</span>
<span class="bridge-step"><span class="bridge-step-label">③ 逆 FFT</span>頻率域 → 空間域</span>
<span class="bridge-result"><span class="bridge-result-label">結果</span><span class="bridge-number">(${oR}, ${oG}, ${oB})</span></span>`;
            break;
          }

          case "PCA": {
            const ret = params.pcaRetention ?? 60;
            html = `
<span class="bridge-step"><span class="bridge-step-label">PCA 保留</span><span class="bridge-number">${ret}%</span></span>
<span class="bridge-step"><span class="bridge-step-label">維度</span>降至保留成分</span>
<span class="bridge-step"><span class="bridge-step-label">重建</span>X ≈ U<sub>k</sub>Σ<sub>k</sub>V<sub>k</sub><sup>T</sup></span>
<span class="bridge-result"><span class="bridge-result-label">結果</span><span class="bridge-number">(${oR}, ${oG}, ${oB})</span></span>`;
            break;
          }

          case "CANNY": {
            const blur = params.cannyBlur ?? 3;
            const low = params.cannyLow ?? 42;
            const high = params.cannyHigh ?? 108;
            const sigma = +(0.65 + blur * 0.45).toFixed(2);
            html = `
<span class="bridge-step"><span class="bridge-step-label">① 平滑</span>高斯 σ=<span class="bridge-number">${sigma}</span></span>
<span class="bridge-step"><span class="bridge-step-label">② 梯度</span>Sobel Gx, Gy</span>
<span class="bridge-step"><span class="bridge-step-label">③ 抑制</span>非極大值</span>
<span class="bridge-step"><span class="bridge-step-label">④ 閾值</span><span class="bridge-number">${low}</span><span class="bridge-arrow">~</span><span class="bridge-number">${high}</span></span>
<span class="bridge-step"><span class="bridge-step-label">⑤ 追蹤</span>滯後連接</span>
<span class="bridge-result"><span class="bridge-result-label">輸出</span><span class="bridge-number">(${oR}, ${oG}, ${oB})</span></span>`;
            break;
          }

          case "WATERMARK": {
            html = `
<span class="bridge-step"><span class="bridge-step-label">公式</span>I' = (1−α)I + α·W</span>
<span class="bridge-step"><span class="bridge-step-label">原圖</span><span class="bridge-number">(${iR}, ${iG}, ${iB})</span></span>
<span class="bridge-step"><span class="bridge-step-label">浮水印疊加</span>α = <span class="bridge-number">${params.alpha ?? 0.3}</span></span>
<span class="bridge-result"><span class="bridge-result-label">結果</span><span class="bridge-number">(${oR}, ${oG}, ${oB})</span></span>`;
            break;
          }

          default:
            html = `
<span class="bridge-step"><span class="bridge-step-label">操作</span>${mode}</span>
<span class="bridge-step"><span class="bridge-step-label">原始</span><span class="bridge-number">(${iR}, ${iG}, ${iB})</span></span>
<span class="bridge-result"><span class="bridge-result-label">結果</span><span class="bridge-number">(${oR}, ${oG}, ${oB})</span></span>`;
        }

        el.innerHTML = html;
      }

      function renderCompareModal(compareState = getCompareViewState()) {
        const isVisible = Boolean(compareModal && compareState.hasRenderable && compareViewMode === "split");
        setCompareModalVisibility(isVisible);
        if (!isVisible) {
          return;
        }

        if (compareBeforeLabel) {
          compareBeforeLabel.textContent = compareState.beforeLabel;
        }
        if (compareAfterLabel) {
          compareAfterLabel.textContent = compareState.afterLabel;
        }

        const beforeDisplay = getDisplayImageData(compareState.beforeImageData);
        const afterDisplay = getDisplayImageData(compareState.afterImageData);
        drawImageDataToSurface(beforeDisplay, compareBeforeCanvas, compareBeforeCtx);
        drawImageDataToSurface(afterDisplay, compareAfterCanvas, compareAfterCtx);
        renderCompareModalMatrices(compareState);

        const beforeSample = buildMatrixSample(compareState.beforeImageData);
        const afterSample = buildMatrixSample(compareState.afterImageData);
        if (beforeSample && afterSample) {
          const inputPixel = [beforeSample.centerR, beforeSample.centerG, beforeSample.centerB];
          const outputPixel = [afterSample.centerR, afterSample.centerG, afterSample.centerB];
          updateMathBridge(lastAppliedMode, lastAppliedParams, inputPixel, outputPixel);
        } else {
          updateMathBridge(lastAppliedMode, lastAppliedParams, null, null);
        }
      }

      function updateWorkspaceControls() {
        if (restoreBtn && !isProcessingLocked) {
          restoreBtn.disabled = !originalImageData;
        }
        if (cancelPreviewBtn && !isProcessingLocked) {
          cancelPreviewBtn.disabled = !hasPendingPreview();
        }
        if (clearABtn && !isProcessingLocked) {
          clearABtn.disabled = !currentImageData && !originalImageData;
        }
        if (clearBBtn && !isProcessingLocked) {
          clearBBtn.disabled = !imageBData;
        }
        // LSB 按鈕：無圖像或訊息為空時禁用
        if (embedBtn && !isProcessingLocked) {
          embedBtn.disabled = !currentImageData || !stegoMessageInput.value.trim();
        }
        if (extractBtn && !isProcessingLocked) {
          extractBtn.disabled = !currentImageData;
        }
        updateCapacityHint();
        updateHistoryControls();
        updateCompareControls();
      }

      // ── 更新工作區顯示狀態（縮放 / 平移 offset 讀數）─────────────────
      function updateWorkspaceDisplay() {
        // 提供 pan/zoom 狀態回饋（若有專用顯示元素則更新，否則預留擴展點）
        const zoomPct = Math.round(canvasScale * 100);
        const offsetInfo = `平移 (${Math.round(dragOffsetX)}, ${Math.round(dragOffsetY)}) × ${zoomPct}%`;
        if (typeof onWorkspaceDisplayUpdate === "function") {
          onWorkspaceDisplayUpdate({ scale: canvasScale, offsetX: dragOffsetX, offsetY: dragOffsetY, zoomPct, offsetInfo });
        }
      }

      function clearPreviewState() {
        clearDeferredPreviewJobs();
        previewImageData = null;
        toolBaseImageData = null;
        activeTool = null;
        clearAdvancedAnalysisState();
      }

      function getRenderableImageData() {
        return previewImageData || currentImageData;
      }

      function ensureRgbDisplayMode() {
        if (displayMode !== "rgb") {
          displayMode = "rgb";
        }
      }

      function beginToolSession(toolName, ensureOptions = null) {
        clearDeferredPreviewJobs(toolName);
        if (!ensureImageLoaded(ensureOptions || {})) return false;
        if (activeTool !== toolName) {
          previewImageData = null;
          toolBaseImageData = cloneImageData(currentImageData);
          activeTool = toolName;
        } else if (!toolBaseImageData) {
          toolBaseImageData = cloneImageData(currentImageData);
        }
        return true;
      }

      function setToolPreview(toolName, builder, options = {}) {
        const hadActivePreview = activeTool === toolName && hasPendingPreview();
        if (!beginToolSession(toolName, options.ensureImageOptions || null)) return false;
        const suppressStatus = Boolean(options.suppressStatus);
        const showError = Boolean(options.showError);
        const showMissing = Boolean(options.showMissing);
        const defaultPreviewMessage = `${toolLabel(toolName)}預覽中，按「套用」才會寫入影像。`;
        const missingMessage = options.missingMessage || "";
        const previewStatusType = options.previewStatusType || "warn";

        ensureRgbDisplayMode();
        let nextPreview = null;
        let built = null;
        try {
          built = builder(toolBaseImageData);
          nextPreview = built && built.imageData ? built.imageData : built;
        } catch (err) {
          previewImageData = null;
          if (typeof options.onPreviewCleared === "function") {
            options.onPreviewCleared();
          }
          refreshCanvasView();
          refreshMatrixView();
          if (!suppressStatus || showError) {
            notifyStatus(
              err.message || `${toolLabel(toolName)}預覽失敗。`,
              "error",
              options.toastError || null
            );
          }
          return false;
        }

        if (!nextPreview) {
          previewImageData = null;
          if (typeof options.onPreviewCleared === "function") {
            options.onPreviewCleared();
          }
          refreshCanvasView();
          refreshMatrixView();
          if ((!suppressStatus || showMissing) && missingMessage) {
            notifyStatus(missingMessage, "warn", options.toastWarn || null);
          }
          return false;
        }

        previewImageData = nextPreview;
        if (typeof options.onPreviewReady === "function") {
          options.onPreviewReady(built);
        }
        refreshCanvasView();
        refreshMatrixView();
        if (!suppressStatus) {
          const resolvedPreviewMessage = resolvePreviewOption(options.previewMessage, built, defaultPreviewMessage);
          setStatus(resolvedPreviewMessage, previewStatusType);
          if (!hadActivePreview) {
            const previewToast = resolvePreviewToast(
              options.previewToast,
              built,
              `${toolLabel(toolName)}預覽中`,
              resolvedPreviewMessage,
              previewStatusType === "warn" ? "warn" : "info"
            );
            if (previewToast) {
              showToast(previewToast);
            }
          }
        }
        updateWorkspaceControls();
        return true;
      }

      async function setToolPreviewAsync(toolName, builder, options = {}) {
        const hadActivePreview = activeTool === toolName && hasPendingPreview();
        if (!beginToolSession(toolName, options.ensureImageOptions || null)) return false;
        const suppressStatus = Boolean(options.suppressStatus);
        const showError = Boolean(options.showError);
        const showMissing = Boolean(options.showMissing);
        const defaultPreviewMessage = `${toolLabel(toolName)}預覽中，按「套用」才會寫入影像。`;
        const missingMessage = options.missingMessage || "";
        const previewStatusType = options.previewStatusType || "warn";

        ensureRgbDisplayMode();
        let built = null;
        try {
          built = await builder(toolBaseImageData);
          if (options.isStale && options.isStale()) {
            return false;
          }
        } catch (err) {
          if (options.isStale && options.isStale()) {
            return false;
          }
          previewImageData = null;
          if (typeof options.onPreviewCleared === "function") {
            options.onPreviewCleared();
          }
          refreshCanvasView();
          refreshMatrixView();
          if (!suppressStatus || showError) {
            notifyStatus(
              err.message || `${toolLabel(toolName)}預覽失敗。`,
              "error",
              options.toastError || null
            );
          }
          return false;
        }

        const nextPreview = built && built.imageData ? built.imageData : built;
        if (!nextPreview) {
          previewImageData = null;
          if (typeof options.onPreviewCleared === "function") {
            options.onPreviewCleared();
          }
          refreshCanvasView();
          refreshMatrixView();
          if ((!suppressStatus || showMissing) && missingMessage) {
            notifyStatus(missingMessage, "warn", options.toastWarn || null);
          }
          return false;
        }

        previewImageData = nextPreview;
        if (typeof options.onPreviewReady === "function") {
          options.onPreviewReady(built);
        }
        const resolvedPreviewMessage = resolvePreviewOption(options.previewMessage, built, defaultPreviewMessage);
        refreshCanvasView();
        refreshMatrixView();
        if (!suppressStatus) {
          setStatus(resolvedPreviewMessage, previewStatusType);
          if (!hadActivePreview) {
            const previewToast = resolvePreviewToast(
              options.previewToast,
              built,
              `${toolLabel(toolName)}預覽中`,
              resolvedPreviewMessage,
              previewStatusType === "warn" ? "warn" : "info"
            );
            if (previewToast) {
              showToast(previewToast);
            }
          }
        }
        updateWorkspaceControls();
        return true;
      }

      function commitPreviewToCurrent(successMessage, toast = null, options = {}) {
        if (!previewImageData) return false;
        const historyLabel = options.historyLabel || successMessage;
        const committedTool = activeTool;
        const preservedAnalysisInfo = options.preserveAnalysisPreview
          ? cloneAnalysisPreviewInfo(committedTool)
          : null;
        const compareBaseImage =
          options.compareBaseImageData || toolBaseImageData || currentImageData || previewImageData;
        ensureRgbDisplayMode();
        currentImageData = cloneImageData(previewImageData);
        captureCompareBaseImage(compareBaseImage);
        clearPreviewState();
        if (options.preserveAnalysisPreview && preservedAnalysisInfo) {
          if (committedTool === "fft") {
            fftPreviewInfo = preservedAnalysisInfo;
          }
          if (committedTool === "pca") {
            pcaPreviewInfo = preservedAnalysisInfo;
          }
          if (committedTool === "canny") {
            cannyPreviewInfo = preservedAnalysisInfo;
          }
        }
        pushHistoryState(historyLabel, currentImageData);
        refreshCanvasView();
        refreshMatrixView();
        notifyStatus(successMessage, "ok", toast);
        updateWorkspaceControls();
        return true;
      }

      function cancelPreview() {
        if (!hasPendingPreview()) {
          notifyStatus("目前沒有待套用的預覽。", "warn", {
            title: "沒有可取消的預覽",
            message: "目前沒有待套用的預覽內容。"
          });
          return;
        }
        clearPreviewState();
        refreshCanvasView();
        refreshMatrixView();
        notifyStatus("已取消預覽，回到已套用結果。", "ok", {
          title: "已取消預覽",
          message: "已回到最近一次套用後的影像結果。"
        });
        updateWorkspaceControls();
      }

      function requireCommittedState(actionName, options = {}) {
        if (!hasPendingPreview()) return true;
        notifyStatus(
          `目前有 ${toolLabel(activeTool)} 預覽尚未套用，請先按「套用」或「取消預覽」後再${actionName}。`,
          "warn",
          options.toast
            ? {
                title: "仍有未套用預覽",
                message: `請先套用或取消目前的${toolLabel(activeTool)}預覽，再${actionName}。`
              }
            : null
        );
        return false;
      }

      function setMatrixExpanded(expanded) {
        isMatrixExpanded = Boolean(expanded);
        if (matrixContent) {
          matrixContent.classList.toggle("collapsed", !isMatrixExpanded);
        }
        if (toggleMatrixBtn) {
          toggleMatrixBtn.textContent = isMatrixExpanded ? "摺疊矩陣" : "展開矩陣";
        }
      }

      function resetWorkspaceAState(imageData = null, options = {}) {
        clearPreviewState();
        resetCompareState();
        originalImageData = imageData ? cloneImageData(imageData) : null;
        currentImageData = imageData ? cloneImageData(imageData) : null;
        fileInputA.value = "";
        selectedPoint = getCenteredSelectedPoint(currentImageData);
        imageInfoA.innerHTML = options.infoHtml || DEFAULT_A_INFO_HTML;
        resetHistory(currentImageData, options.historyLabel || "初始化");
        refreshCanvasView();
        refreshMatrixView();
        updateWorkspaceControls();
      }

      function clearImageAData() {
        if (!currentImageData && !originalImageData) {
          notifyStatus("A 圖尚未載入。", "warn", {
            title: "沒有可清除的 A 圖",
            message: "目前沒有主圖 A，可以先上傳或載入示範圖。"
          });
          return;
        }

        resetWorkspaceAState(null);
        notifyStatus("已清除 A 圖，工作區已重置。", "ok", {
          title: "已清除 A 圖",
          message: "主圖、歷史、預覽與分析快取都已清除。"
        });
      }

      function clearImageBData() {
        const hadImageB = Boolean(imageBData);
        imageBData = null;
        fileInputB.value = "";
        imageInfoB.innerHTML = DEFAULT_B_INFO_HTML;

        const wasBlendPreview = activeTool === "blend" && hasPendingPreview();
        if (wasBlendPreview) {
          clearPreviewState();
          refreshCanvasView();
          refreshMatrixView();
          notifyStatus("已清除 B 圖，混合預覽也已取消。", "ok", {
            title: "已清除 B 圖",
            message: "B 圖已清除，混合預覽也已一併取消。"
          });
          updateWorkspaceControls();
          return;
        }

        updateAllPreviews();
        if (hadImageB) {
          notifyStatus("已清除 B 圖。", "ok", {
            title: "已清除 B 圖",
            message: "混合用的 B 圖已從工作區清除。"
          });
        } else {
          notifyStatus("B 圖尚未上傳。", "warn", {
            title: "B 圖尚未載入",
            message: "目前沒有可清除的圖片（B）。"
          });
        }
        updateWorkspaceControls();
      }

      function updateModeStatus() {
        modeText.textContent = `顯示模式：${modeLabel(displayMode)}`;
        channelBtns.forEach((btn) => {
          if (btn.dataset.mode === displayMode) {
            btn.classList.add("primary");
          } else {
            btn.classList.remove("primary");
          }
        });
      }

      function updateMatrixChannelView() {
        matrixChannelBtns.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.matrixChannel === matrixViewChannel);
        });
        matrixPanels.forEach((panel) => {
          panel.classList.toggle("active", panel.dataset.matrixChannel === matrixViewChannel);
        });
      }

      function syncWatermarkPosButtons() {
        watermarkPosButtons.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.watermarkPos === watermarkPosInput.value);
        });
      }

      function toggleSecondaryTray(forceOpen) {
        if (!secondaryToolsTray || !moreToolsToggle) return;
        const nextState = typeof forceOpen === "boolean" ? forceOpen : secondaryToolsTray.hidden;
        secondaryToolsTray.hidden = !nextState;
        moreToolsToggle.setAttribute("aria-expanded", String(nextState));
      }

      function formatImageInfo(fileName, sourceWidth, sourceHeight, workspaceWidth = sourceWidth, workspaceHeight = sourceHeight) {
        const workspacePixels = Math.max(1, workspaceWidth * workspaceHeight);
        return [
          infoStat("檔名", fileName),
          infoStat("原始尺寸", `${sourceWidth} × ${sourceHeight}`),
          infoStat("工作尺寸", `${workspaceWidth} × ${workspaceHeight}`),
          infoStat("工作像素", workspacePixels.toLocaleString()),
          infoStat("通道", "RGB")
        ].join("");
      }

      function drawPreview(ctx2D, imageData, emptyText) {
        if (!ctx2D) {
          return;
        }
        const w = ctx2D.canvas.width;
        const h = ctx2D.canvas.height;
        ctx2D.fillStyle = "#02060f";
        ctx2D.fillRect(0, 0, w, h);
        if (!imageData) {
          ctx2D.fillStyle = "#96afd7";
          ctx2D.font = "12px Segoe UI, sans-serif";
          ctx2D.textAlign = "center";
          ctx2D.textBaseline = "middle";
          ctx2D.fillText(emptyText, w / 2, h / 2);
          return;
        }

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        const tempCtx = tempCanvas.getContext("2d");
        tempCtx.putImageData(imageData, 0, 0);
        const previewBox = getContainRect(imageData.width, imageData.height, w, h);
        ctx2D.drawImage(tempCanvas, previewBox.x, previewBox.y, previewBox.width, previewBox.height);
        tempCanvas.width = 0;
        tempCanvas.height = 0;
      }

      function getLSBCapacityInfo(sourceImageData = getPrimaryWorkspaceImage()) {
        if (!sourceImageData) {
          return {
            capacityBits: 0,
            usableBytes: 0,
            approxChinese: 0
          };
        }

        const width = Number.isFinite(sourceImageData.width) && sourceImageData.width > 0 ? sourceImageData.width : 0;
        const height = Number.isFinite(sourceImageData.height) && sourceImageData.height > 0 ? sourceImageData.height : 0;
        const capacityBits = Math.max(0, width * height * 3);
        const usableBits = Math.max(0, capacityBits - LSB_HEADER_BITS);
        const usableBytes = Math.max(0, Math.floor(usableBits / 8));
        return {
          capacityBits,
          usableBytes,
          approxChinese: Math.max(0, Math.floor(usableBytes / 3))
        };
      }

      function updateCapacityHint() {
        if (!capacityText) {
          return;
        }

        const { usableBytes, approxChinese } = getLSBCapacityInfo();
        capacityText.textContent =
          `約 ${usableBytes.toLocaleString()} bytes，可容納約 ${approxChinese.toLocaleString()} 個常見中文字`;
      }

      function updateFFTModeButtons() {
        fftModeButtons.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.fftMode === fftMode);
        });
      }

      function updateFFTStrengthLabel() {
        if (fftStrengthVal && fftStrengthInput) {
          fftStrengthVal.textContent = fftStrengthInput.value;
        }
      }

      function updatePCARetentionLabel() {
        if (pcaRetentionVal && pcaRetentionInput) {
          pcaRetentionVal.textContent = `${pcaRetentionInput.value}%`;
        }
      }

      function normalizeCannyThresholds(changedInput = null) {
        if (!cannyLowThresholdInput || !cannyHighThresholdInput) {
          return { adjusted: false, which: null };
        }
        const minGap = 1;
        let low = clamp(Number(cannyLowThresholdInput.value) || 10, 10, 120);
        let high = clamp(Number(cannyHighThresholdInput.value) || 40, 40, 220);
        let adjusted = false;
        let which = null;

        if (low >= high) {
          if (changedInput === "low") {
            high = low + minGap;
            which = "high";
          } else if (changedInput === "high") {
            low = high - minGap;
            which = "low";
          } else {
            high = low + minGap;
            which = "high";
          }
          high = clamp(high, 40, 220);
          low = clamp(low, 10, 120);
          if (low >= high) {
            if (which === "high") {
              low = clamp(high - minGap, 10, 120);
            } else {
              high = clamp(low + minGap, 40, 220);
            }
          }
          adjusted = true;
        }

        cannyLowThresholdInput.value = String(low);
        cannyHighThresholdInput.value = String(high);

        return { adjusted, which };
      }

      function updateCannyControlLabels(changedInput = null) {
        const normResult = normalizeCannyThresholds(changedInput);
        if (cannyBlurVal && cannyBlurInput) {
          cannyBlurVal.textContent = cannyBlurInput.value;
        }
        if (cannyLowThresholdVal && cannyLowThresholdInput) {
          cannyLowThresholdVal.textContent = cannyLowThresholdInput.value;
        }
        if (cannyHighThresholdVal && cannyHighThresholdInput) {
          cannyHighThresholdVal.textContent = cannyHighThresholdInput.value;
        }
        if (normResult.adjusted) {
          showToast({
            type: "warn",
            title: "演算法限制",
            message: "低閾值必須 < 高閾值，系統已自動調整。",
            timeout: 2500
          });
        }
      }

      // ── Canny 觸控友善：Slider 懸浮氣泡 ────────────────────────────────
      function positionCannyBubble(input, bubble) {
        if (!input || !bubble) return;
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);
        const val = parseFloat(input.value);
        const pct = (val - min) / (max - min);
        const trackW = input.offsetWidth;
        const thumbW = 22; // 與 CSS thumb 直徑一致
        const offset = pct * (trackW - thumbW) + thumbW / 2;
        bubble.style.left = `${offset}px`;
        bubble.textContent = input.value;
      }

      function syncCannyBubbleVisibility(bubble, visible) {
        if (!bubble) return;
        if (visible) {
          bubble.classList.add("is-visible");
        } else {
          bubble.classList.remove("is-visible");
        }
      }

      function bindCannySliderBubble(input, bubble) {
        if (!input || !bubble) return;
        const show = () => {
          positionCannyBubble(input, bubble);
          syncCannyBubbleVisibility(bubble, true);
        };
        const hide = () => {
          syncCannyBubbleVisibility(bubble, false);
        };

        input.addEventListener("pointerenter", show);
        input.addEventListener("pointerdown", show);
        input.addEventListener("pointermove", (e) => {
          if (e.buttons > 0) {
            positionCannyBubble(input, bubble);
          }
        });
        input.addEventListener("pointerup", hide);
        input.addEventListener("pointerleave", hide);
        input.addEventListener("focus", show);
        input.addEventListener("blur", hide);

        // 避免滑鼠鬆開時殘留
        input.addEventListener("change", hide);
      }

      function getCannyControlSettings() {
        updateCannyControlLabels();
        return {
          blurStrength: clamp(Number(cannyBlurInput?.value) || 3, 1, 5),
          lowThreshold: clamp(Number(cannyLowThresholdInput?.value) || 42, 10, 120),
          highThreshold: clamp(Number(cannyHighThresholdInput?.value) || 108, 40, 220)
        };
      }

      function updateSpatialFilterUI() {
        if (!spatialFilterStrengthInput || !spatialFilterStrengthLabel || !spatialFilterStrengthVal || !spatialFilterFormula) {
          return;
        }

        if (spatialFilterMode === "gaussian") {
          spatialFilterStrengthLabel.textContent = "卷積核大小";
          spatialFilterStrengthInput.min = "3";
          spatialFilterStrengthInput.max = "9";
          spatialFilterStrengthInput.step = "2";
          if (![3, 5, 7, 9].includes(Number(spatialFilterStrengthInput.value))) {
            spatialFilterStrengthInput.value = "5";
          }
          spatialFilterStrengthVal.textContent = `${spatialFilterStrengthInput.value}×${spatialFilterStrengthInput.value}`;
          spatialFilterFormula.innerHTML =
            "$G_\\sigma(x,y) = \\frac{1}{2\\pi\\sigma^2}e^{-\\frac{x^2+y^2}{2\\sigma^2}}$ 高斯核與影像卷積，平滑高頻細節";
          typesetMath(spatialFilterFormula);
        } else if (spatialFilterMode === "sharpen") {
          spatialFilterStrengthLabel.textContent = "銳化強度 λ";
          spatialFilterStrengthInput.min = "20";
          spatialFilterStrengthInput.max = "240";
          spatialFilterStrengthInput.step = "10";
          if (Number(spatialFilterStrengthInput.value) < 20 || Number(spatialFilterStrengthInput.value) > 240) {
            spatialFilterStrengthInput.value = "120";
          }
          spatialFilterStrengthVal.textContent = `${(Number(spatialFilterStrengthInput.value) / 100).toFixed(2)}x`;
          spatialFilterFormula.innerHTML =
            "$\\lambda$ 銳化核：$I' = I + \\lambda \\nabla^2 I$，增強局部對比";
          typesetMath(spatialFilterFormula);
        } else {
          spatialFilterStrengthLabel.textContent = "輪廓強度";
          spatialFilterStrengthInput.min = "40";
          spatialFilterStrengthInput.max = "220";
          spatialFilterStrengthInput.step = "10";
          if (Number(spatialFilterStrengthInput.value) < 40 || Number(spatialFilterStrengthInput.value) > 220) {
            spatialFilterStrengthInput.value = "100";
          }
          spatialFilterStrengthVal.textContent = `${(Number(spatialFilterStrengthInput.value) / 100).toFixed(2)}x`;
          spatialFilterFormula.innerHTML =
            "Sobel 梯度：$|\\nabla I| = \\sqrt{G_x^2 + G_y^2}$，偵測邊緣與輪廓";
          typesetMath(spatialFilterFormula);
        }

        filterModeButtons.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.filterMode === spatialFilterMode);
        });
      }

      function hydrateAdvancedToolCopy() {
        const fftCard = document.querySelector(".advanced-card--fft");
        if (fftCard) {
          const title = fftCard.querySelector("h3");
          const subtitle = fftCard.querySelector(".card-subtitle");
          const strengthLabel = fftCard.querySelector('label[for="fftStrength"]');
          const sourceCaption = fftCard.querySelector(".analysis-preview-card--source figcaption");
          const resultCaption = fftCard.querySelector(".analysis-preview-card--result figcaption");
          const formula = fftCard.querySelector(".formula");

          if (title) title.textContent = "傅立葉轉換（FFT）";
          if (subtitle) subtitle.textContent = "頻域分析、頻譜預覽與低通 / 高通濾波";
          if (strengthLabel) strengthLabel.textContent = "強度";
          if (sourceCaption) sourceCaption.textContent = "來源影像";
          if (resultCaption) resultCaption.textContent = "頻譜 / 處理結果";
          if (formula) {
            formula.remove();
          }
        }

        fftModeButtons.forEach((btn) => {
          if (btn.dataset.fftMode === "spectrum") btn.textContent = "頻譜";
          if (btn.dataset.fftMode === "lowpass") btn.textContent = "低通濾波";
          if (btn.dataset.fftMode === "highpass") btn.textContent = "高通濾波";
        });
        if (applyFFTBtn) {
          applyFFTBtn.textContent = "套用 FFT";
        }
        if (fftPreviewSource) {
          fftPreviewSource.setAttribute("aria-label", "FFT 來源縮圖");
        }
        if (fftPreviewResult) {
          fftPreviewResult.setAttribute("aria-label", "FFT 結果縮圖");
        }

        const filterCard = document.querySelector(".advanced-card--filter");
        if (filterCard) {
          const badge = filterCard.querySelector(".advanced-badge");
          const previewKicker = filterCard.querySelector(".advanced-card__preview-kicker");

          if (badge) badge.textContent = "進階";
          if (previewKicker) previewKicker.textContent = "預覽面板";
        }

        filterModeButtons.forEach((btn) => {
          if (btn.dataset.filterMode === "gaussian") btn.textContent = "高斯模糊";
          if (btn.dataset.filterMode === "sharpen") btn.textContent = "銳化";
          if (btn.dataset.filterMode === "edge") btn.textContent = "邊緣偵測";
        });

        const pcaCard = document.querySelector(".advanced-card--pca");
        if (pcaCard) {
          const title = pcaCard.querySelector("h3");
          const subtitle = pcaCard.querySelector(".card-subtitle");
          const retentionLabel = pcaCard.querySelector('label[for="pcaRetention"]');
          const sourceCaption = pcaCard.querySelector(".analysis-preview-card--source figcaption");
          const latentCaption = pcaCard.querySelector(".analysis-preview-card--latent figcaption");
          const resultCaption = pcaCard.querySelector(".analysis-preview-card--result figcaption");
          const metricLabels = pcaCard.querySelectorAll(".metric-pill span");
          const formula = pcaCard.querySelector(".formula");

          if (title) title.textContent = "主成分分析（PCA）";
          if (subtitle) subtitle.textContent = "降維壓縮、資訊保留與影像重建";
          if (retentionLabel) retentionLabel.textContent = "保留成分";
          if (sourceCaption) sourceCaption.textContent = "來源影像";
          if (latentCaption) latentCaption.textContent = "低維表示";
          if (resultCaption) resultCaption.textContent = "重建結果";
          if (metricLabels[0]) metricLabels[0].textContent = "壓縮比";
          if (metricLabels[1]) metricLabels[1].textContent = "資訊保留率";
          if (formula) {
            formula.remove();
          }
        }

        if (applyPCABtn) {
          applyPCABtn.textContent = "套用 PCA";
        }
        if (pcaPreviewSource) {
          pcaPreviewSource.setAttribute("aria-label", "PCA 來源縮圖");
        }
        if (pcaPreviewLatent) {
          pcaPreviewLatent.setAttribute("aria-label", "PCA 低維表示縮圖");
        }
        if (pcaPreviewResult) {
          pcaPreviewResult.setAttribute("aria-label", "PCA 重建結果縮圖");
        }

        const cannyCard = document.querySelector(".advanced-card--canny");
        if (cannyCard) {
          const title = cannyCard.querySelector("h3");
          const subtitle = cannyCard.querySelector(".card-subtitle");
          const badge = cannyCard.querySelector(".advanced-badge");
          const mathChip = cannyCard.querySelector(".math-chip");
          const blurLabel = cannyCard.querySelector('label[for="cannyBlur"]');
          const lowLabel = cannyCard.querySelector('label[for="cannyLowThreshold"]');
          const highLabel = cannyCard.querySelector('label[for="cannyHighThreshold"]');
          const previewKicker = cannyCard.querySelector(".advanced-card__preview-kicker");
          const sourceCaption = cannyCard.querySelector(".analysis-preview-card--source figcaption");
          const resultCaption = cannyCard.querySelector(".analysis-preview-card--result figcaption");
          const metricLabels = cannyCard.querySelectorAll(".metric-pill span");
          const formula = cannyCard.querySelector(".formula");
          const note = cannyCard.querySelector(".canny-note");

          if (title) title.textContent = "Canny 邊緣偵測";
          if (subtitle) subtitle.textContent = "多步驟輪廓擷取";
          if (badge) badge.textContent = "進階";
          if (mathChip) {
            mathChip.textContent = "灰階 → 高斯平滑 → Sobel 梯度 → 非極大值抑制 → 雙閾值 → 滯後追蹤";
          }
          if (blurLabel) blurLabel.textContent = "模糊強度";
          if (lowLabel) lowLabel.textContent = "低閾值";
          if (highLabel) highLabel.textContent = "高閾值";
          if (previewKicker) previewKicker.textContent = "預覽輸出";
          if (sourceCaption) sourceCaption.textContent = "原圖";
          if (resultCaption) resultCaption.textContent = "邊緣圖";
          if (metricLabels[0]) metricLabels[0].textContent = "穩定邊緣";
          if (metricLabels[1]) metricLabels[1].textContent = "滯後連接";
          if (metricLabels[2]) metricLabels[2].textContent = "邊緣密度";
          if (formula) {
            formula.textContent = "先降噪，再找梯度，最後用雙閾值連接穩定邊緣";
          }
          if (note) {
            note.textContent =
              "Canny 用於找出圖像中的穩定邊緣，比單純 Sobel 更乾淨，常見於文件掃描、醫學影像、工業檢測。";
          }
        }
        if (applyCannyBtn) {
          applyCannyBtn.textContent = "套用 Canny";
        }
        if (cannyPreviewSource) {
          cannyPreviewSource.setAttribute("aria-label", "Canny 原圖縮圖");
        }
        if (cannyPreviewResult) {
          cannyPreviewResult.setAttribute("aria-label", "Canny 邊緣圖縮圖");
        }
      }

      function updateAdvancedToolPreviews() {
        const baseSource = currentImageData;
        const fftHasActivePreview = activeTool === "fft" && hasPendingPreview();
        const pcaHasActivePreview = activeTool === "pca" && hasPendingPreview();
        const cannyHasActivePreview = activeTool === "canny" && hasPendingPreview();
        const fftSourceImage =
          fftHasActivePreview && toolBaseImageData
            ? toolBaseImageData
            : fftPreviewInfo && lastCompareBaseImageData
              ? lastCompareBaseImageData
              : baseSource;
        const pcaSourceImage =
          pcaHasActivePreview && toolBaseImageData
            ? toolBaseImageData
            : pcaPreviewInfo && lastCompareBaseImageData
              ? lastCompareBaseImageData
              : baseSource;
        const cannySourceImage =
          cannyHasActivePreview && toolBaseImageData
            ? toolBaseImageData
            : cannyPreviewInfo && lastCompareBaseImageData
              ? lastCompareBaseImageData
              : baseSource;

        drawPreview(fftPreviewSourceCtx, fftSourceImage, "尚無 A 圖");
        drawPreview(
          fftPreviewResultCtx,
          fftPreviewInfo ? fftPreviewInfo.resultImageData : null,
          "調整模式或強度後預覽"
        );

        drawPreview(pcaPreviewSourceCtx, pcaSourceImage, "尚無 A 圖");
        drawPreview(
          pcaPreviewLatentCtx,
          pcaPreviewInfo ? pcaPreviewInfo.latentImageData : null,
          "低維表示將顯示於此"
        );
        drawPreview(
          pcaPreviewResultCtx,
          pcaPreviewInfo ? pcaPreviewInfo.resultImageData : null,
          "調整保留成分後預覽"
        );
        updatePCAMetrics(pcaPreviewInfo || null);

        drawPreview(cannyPreviewSourceCtx, cannySourceImage, "尚無 A 圖");
        drawPreview(
          cannyPreviewResultCtx,
          cannyPreviewInfo ? cannyPreviewInfo.resultImageData : null,
          "調整 blur / threshold 後預覽"
        );
        updateCannyMetrics(cannyPreviewInfo || null);

        // 空間域濾鏡縮圖更新
        const spatialFilterHasActivePreview = activeTool === "spatialFilter" && hasPendingPreview();
        const spatialFilterSourceImage =
          spatialFilterHasActivePreview && toolBaseImageData
            ? toolBaseImageData
            : baseSource;
        drawPreview(spatialFilterPreviewSourceCtx, spatialFilterSourceImage, "尚無 A 圖");
        drawPreview(
          spatialFilterPreviewResultCtx,
          spatialFilterPreviewInfo ? spatialFilterPreviewInfo.resultImageData : null,
          "調整模式或強度後預覽"
        );
      }

      function updateAllPreviews() {
        drawPreview(previewACtx, getRenderableImageData(), "尚無 A 圖");
        drawPreview(previewBCtx, imageBData, "尚無 B 圖");
        updateAdvancedToolPreviews();
      }

      function clearMainCanvas() {
        ctx.fillStyle = "#030711";
        ctx.fillRect(0, 0, DISPLAY_CANVAS_WIDTH, DISPLAY_CANVAS_HEIGHT);
      }

      function drawImageDataToCanvas(imageData) {
        drawImageDataToSurface(imageData, mainCanvas, ctx);
      }

      function drawCompareSplitView(beforeImageData, afterImageData) {
        clearMainCanvas();
        const renderBox = getMainCanvasRenderBox(afterImageData || beforeImageData);
        if (!renderBox) {
          return;
        }

        const splitX = renderBox.x + Math.floor(renderBox.width / 2);
        const beforeCanvas = imageDataToCanvas(beforeImageData);
        const afterCanvas = imageDataToCanvas(afterImageData);

        ctx.save();
        ctx.beginPath();
        ctx.rect(renderBox.x, renderBox.y, splitX - renderBox.x, renderBox.height);
        ctx.clip();
        ctx.drawImage(beforeCanvas, renderBox.x, renderBox.y, renderBox.width, renderBox.height);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, renderBox.y, renderBox.x + renderBox.width - splitX, renderBox.height);
        ctx.clip();
        ctx.drawImage(afterCanvas, renderBox.x, renderBox.y, renderBox.width, renderBox.height);
        ctx.restore();
      }

      function getDisplayImageData(sourceImageData) {
        if (!sourceImageData) return null;
        const output = cloneImageData(sourceImageData);
        if (displayMode === "rgb") return output;

        const keepChannel = displayMode === "r" ? 0 : displayMode === "g" ? 1 : 2;
        const d = output.data;
        for (let i = 0; i < d.length; i += CHANNELS) {
          if (keepChannel !== 0) d[i] = 0;
          if (keepChannel !== 1) d[i + 1] = 0;
          if (keepChannel !== 2) d[i + 2] = 0;
        }
        return output;
      }

      function renderChannelView(mode) {
        displayMode = mode;
        refreshCanvasView();
      }

      function refreshCanvasView() {
        const compareState = getCompareViewState();
        if (!compareState.afterImageData) {
          clearMainCanvas();
          updateModeStatus();
          updateWorkspaceControls();
          updateAllPreviews();
          renderCompareModal(compareState);
          return;
        }

        const displayData = getDisplayImageData(compareState.afterImageData);
        drawImageDataToCanvas(displayData);
        updateModeStatus();
        updateWorkspaceControls();
        updateAllPreviews();
        renderCompareModal(compareState);
      }

      function buildMatrixSample(imageData, point = selectedPoint) {
        if (!imageData) {
          return null;
        }

        const width = imageData.width;
        const height = imageData.height;
        const n = Math.max(1, Math.min(sampleSizeN, width, height));
        const half = Math.floor(n / 2);
        const cx = Math.min(width - 1, Math.max(0, point.x));
        const cy = Math.min(height - 1, Math.max(0, point.y));

        let startX = cx - half;
        let startY = cy - half;
        startX = Math.max(0, Math.min(width - n, startX));
        startY = Math.max(0, Math.min(height - n, startY));

        const rRows = [];
        const gRows = [];
        const bRows = [];
        const d = imageData.data;

        for (let y = 0; y < n; y += 1) {
          const rowR = [];
          const rowG = [];
          const rowB = [];
          for (let x = 0; x < n; x += 1) {
            const px = startX + x;
            const py = startY + y;
            const idx = (py * width + px) * CHANNELS;
            rowR.push(d[idx]);
            rowG.push(d[idx + 1]);
            rowB.push(d[idx + 2]);
          }
          rRows.push(rowR);
          gRows.push(rowG);
          bRows.push(rowB);
        }

        const centerIndex = (cy * width + cx) * CHANNELS;
        const centerR = d[centerIndex];
        const centerG = d[centerIndex + 1];
        const centerB = d[centerIndex + 2];

        return {
          n,
          cx,
          cy,
          startX,
          startY,
          centerR,
          centerG,
          centerB,
          pointText: `(${cx}, ${cy})`,
          centerText: `(${centerR}, ${centerG}, ${centerB})`,
          rangeText: `x: ${startX} ~ ${startX + n - 1}, y: ${startY} ~ ${startY + n - 1}`,
          rText: toMatrixText(rRows),
          gText: toMatrixText(gRows),
          bText: toMatrixText(bRows)
        };
      }

      function refreshMatrixView() {
        const matrixSource = getRenderableImageData();
        const sample = buildMatrixSample(matrixSource);
        if (!sample) {
          matrixR.textContent = "";
          matrixG.textContent = "";
          matrixB.textContent = "";
          coordText.textContent = "(-, -)";
          centerPixelText.textContent = "(-, -, -)";
          matrixRangeText.textContent = "x: -, y: -";
          if (centerPixelEcho) {
            centerPixelEcho.textContent = "(-, -, -)";
          }
          updateMatrixChannelView();
          renderCompareModalMatrices();
          return;
        }

        coordText.textContent = sample.pointText;
        centerPixelText.textContent = sample.centerText;
        matrixRangeText.textContent = sample.rangeText;
        if (centerPixelEcho) {
          centerPixelEcho.textContent = centerPixelText.textContent;
        }

        matrixR.textContent = sample.rText;
        matrixG.textContent = sample.gText;
        matrixB.textContent = sample.bText;
        updateMatrixChannelView();
        renderCompareModalMatrices();
      }

      function toMatrixText(rows) {
        return rows
          .map((row) => `[ ${row.map((v) => String(v).padStart(3, " ")).join(" ")} ]`)
          .join("\n");
      }

      function fitImageToWorkspace(img) {
        const workspaceSize = getBoundedImageSize(img.width, img.height);
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = workspaceSize.width;
        tempCanvas.height = workspaceSize.height;
        const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.drawImage(img, 0, 0, workspaceSize.width, workspaceSize.height);
        const result = tempCtx.getImageData(0, 0, workspaceSize.width, workspaceSize.height);
        tempCanvas.width = 0;
        tempCanvas.height = 0;
        return result;
      }

      function loadImageElement(src, errorMessage = "圖片載入失敗，請確認檔案格式。") {
        return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(errorMessage));
          image.src = src;
        });
      }

      function applyLoadedImage(img, sourceName, target = "A") {
        const fitted = fitImageToWorkspace(img);
        if (target === "A") {
          resetWorkspaceAState(fitted, {
            infoHtml: formatImageInfo(sourceName, img.width, img.height, fitted.width, fitted.height),
            historyLabel: `載入 A 圖：${sourceName}`
          });
          setStatus(`A 圖已載入：${sourceName}`, "ok");
        } else {
          clearPreviewState();
          imageBData = cloneImageData(fitted);
          imageInfoB.innerHTML = formatImageInfo(sourceName, img.width, img.height, fitted.width, fitted.height);
          refreshCanvasView();
          refreshMatrixView();
          setStatus(`B 圖已載入：${sourceName}（可進行混合）`, "ok");
        }
        updateWorkspaceControls();
      }

      async function loadImageToCanvas(file, target = "A") {
        if (!file) return;
        const objectURL = URL.createObjectURL(file);
        try {
          const img = await loadImageElement(objectURL);
          applyLoadedImage(img, file.name, target);
        } catch (err) {
          setStatus(err.message || "圖片載入失敗。", "error");
        } finally {
          URL.revokeObjectURL(objectURL);
        }
      }

      async function loadImageFromPath(path, displayName, target = "A", options = {}) {
        if (!path) return;
        const isLocalFile = window.location.protocol === "file:";

        // Local file 模式：使用 Base64 內嵌圖，徹底避開 CORS / fetch SecurityError
        if (isLocalFile) {
          const dataUrl =
            typeof window !== "undefined" && typeof window.__FUJI_DEMO_DATA_URL === "string"
              ? window.__FUJI_DEMO_DATA_URL
              : "";
          try {
            const img = await loadImageElement(dataUrl, "無法載入內嵌示範圖。");
            applyLoadedImage(img, displayName || "Fuji（內建）", target);
            if (options.toast) {
              showToast({
                type: "ok",
                title: "示範圖已載入",
                message: `已載入：${displayName || "Fuji（內建）"}`
              });
            }
            return;
          } catch (err) {
            notifyStatus(
              "無法載入內嵌示範圖。請改用本機伺服器或上傳按鈕。",
              "error",
              options.toast
                ? { title: "示範圖載入失敗" }
                : null
            );
            return;
          }
        }

        // HTTP/HTTPS 模式：使用 fetch 載入圖片
        const encodedPath = encodeURI(path);
        let objectURL = "";
        try {
          const response = await fetch(encodedPath, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`示範圖片載入失敗（HTTP ${response.status}）。`);
          }
          const blob = await response.blob();
          objectURL = URL.createObjectURL(blob);
          const img = await loadImageElement(objectURL, "示範圖片載入失敗，請確認檔案是否存在。");
          applyLoadedImage(img, displayName || path, target);
          if (options.toast) {
            showToast({
              type: "ok",
              title: "示範圖已載入",
              message: `已載入：${displayName || path}`
            });
          }
        } catch (err) {
          try {
            if (!DEMO_FUJI_FALLBACK_DATA_URL) {
              throw err;
            }
            const fallbackImg = await loadImageElement(
              DEMO_FUJI_FALLBACK_DATA_URL,
              "示範圖片備援載入失敗。"
            );
            applyLoadedImage(fallbackImg, displayName || "Fuji（內建備援）", target);
            setStatus("示範圖已透過內建備援載入。", "ok");
            if (options.toast) {
              showToast({
                type: "ok",
                title: "示範圖已載入",
                message: `已透過內建備援載入：${displayName || "Fuji（內建備援）"}`
              });
            }
          } catch (fallbackErr) {
            notifyStatus(
              fallbackErr.message ||
                "示範圖片載入失敗。若使用 file:// 開啟頁面，請改用本機伺服器或直接用上傳按鈕。",
              "error",
              options.toast
                ? {
                    title: "示範圖載入失敗"
                  }
                : null
            );
          }
        } finally {
          if (objectURL) {
            URL.revokeObjectURL(objectURL);
          }
        }
      }

      function resolveDemoImageTarget() {
        const hasImageA = Boolean(getPrimaryWorkspaceImage());
        if (!hasImageA) {
          return "A";
        }
        if (!imageBData) {
          return "B";
        }
        return window.confirm("目前 A / B 圖都已有內容。要用示範圖取代目前的 A 圖嗎？") ? "A" : null;
      }

      function generateDefaultTestImage() {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = DISPLAY_CANVAS_WIDTH;
        tempCanvas.height = DISPLAY_CANVAS_HEIGHT;
        const tctx = tempCanvas.getContext("2d", { willReadFrequently: true });

        const grad = tctx.createLinearGradient(0, 0, DISPLAY_CANVAS_WIDTH, DISPLAY_CANVAS_HEIGHT);
        grad.addColorStop(0, "#11244c");
        grad.addColorStop(0.5, "#1c5ca8");
        grad.addColorStop(1, "#0f8a84");
        tctx.fillStyle = grad;
        tctx.fillRect(0, 0, DISPLAY_CANVAS_WIDTH, DISPLAY_CANVAS_HEIGHT);

        const radial = tctx.createRadialGradient(140, 90, 10, 140, 90, 180);
        radial.addColorStop(0, "rgba(255,255,255,0.55)");
        radial.addColorStop(1, "rgba(255,255,255,0)");
        tctx.fillStyle = radial;
        tctx.fillRect(0, 0, DISPLAY_CANVAS_WIDTH, DISPLAY_CANVAS_HEIGHT);

        tctx.strokeStyle = "rgba(255,255,255,0.2)";
        tctx.lineWidth = 2;
        for (let x = 0; x <= DISPLAY_CANVAS_WIDTH; x += 30) {
          tctx.beginPath();
          tctx.moveTo(x, 0);
          tctx.lineTo(x, DISPLAY_CANVAS_HEIGHT);
          tctx.stroke();
        }
        for (let y = 0; y <= DISPLAY_CANVAS_HEIGHT; y += 30) {
          tctx.beginPath();
          tctx.moveTo(0, y);
          tctx.lineTo(DISPLAY_CANVAS_WIDTH, y);
          tctx.stroke();
        }

        tctx.fillStyle = "rgba(255, 216, 119, 0.9)";
        tctx.beginPath();
        tctx.arc(460, 120, 58, 0, Math.PI * 2);
        tctx.fill();
        tctx.fillStyle = "rgba(255, 120, 120, 0.9)";
        tctx.fillRect(85, 220, 150, 95);
        tctx.fillStyle = "rgba(126, 244, 191, 0.9)";
        tctx.beginPath();
        tctx.moveTo(310, 310);
        tctx.lineTo(410, 170);
        tctx.lineTo(530, 320);
        tctx.closePath();
        tctx.fill();

        const generated = tctx.getImageData(0, 0, DISPLAY_CANVAS_WIDTH, DISPLAY_CANVAS_HEIGHT);
        // 釋放暫存 canvas 記憶體
        tempCanvas.width = 0;
        tempCanvas.height = 0;
        resetWorkspaceAState(generated, {
          infoHtml: formatImageInfo(
            "預設測試圖（幾何漸層）",
            DISPLAY_CANVAS_WIDTH,
            DISPLAY_CANVAS_HEIGHT,
            generated.width,
            generated.height
          ),
          historyLabel: "載入預設測試圖"
        });
        imageInfoB.innerHTML = DEFAULT_B_INFO_HTML;
      }

      function applyBrightnessContrast(sourceImageData, b, c) {
        const output = cloneImageData(sourceImageData);
        const d = output.data;
        for (let i = 0; i < d.length; i += CHANNELS) {
          d[i] = clampByte((d[i] - 128) * c + 128 + b);
          d[i + 1] = clampByte((d[i + 1] - 128) * c + 128 + b);
          d[i + 2] = clampByte((d[i + 2] - 128) * c + 128 + b);
        }
        return output;
      }

      function blendTwoImages(imageAData, imageBDataInput, alpha) {
        if (!imageAData || !imageBDataInput) return null;
        const imageBData =
          imageBDataInput.width === imageAData.width && imageBDataInput.height === imageAData.height
            ? imageBDataInput
            : scaleImageDataToSize(imageBDataInput, imageAData.width, imageAData.height, {
                smoothing: true
              });
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

      function embedMessageLSB(sourceImageData, message) {
        if (!message) {
          throw new Error("請先輸入要藏入的訊息。");
        }

        const encoder = new TextEncoder();
        const payload = encoder.encode(message);
        const messageLength = payload.length;

        const { capacityBits, usableBytes } = getLSBCapacityInfo(sourceImageData);
        const requiredBits = LSB_HEADER_BITS + messageLength * 8;
        if (requiredBits > capacityBits) {
          throw new Error(`訊息過長：目前最多可藏 ${usableBytes} bytes（UTF-8）。`);
        }

        const output = cloneImageData(sourceImageData);
        const d = output.data;
        let bitIndex = 0;

        function getBitAt(index) {
          if (index < LSB_HEADER_BITS) {
            const shift = 31 - index;
            return (messageLength >>> shift) & 1;
          }
          const payloadBitIndex = index - LSB_HEADER_BITS;
          const byteIndex = Math.floor(payloadBitIndex / 8);
          const bitOffset = 7 - (payloadBitIndex % 8);
          return (payload[byteIndex] >>> bitOffset) & 1;
        }

        for (let i = 0; i < d.length && bitIndex < requiredBits; i += CHANNELS) {
          for (let c = 0; c < 3 && bitIndex < requiredBits; c += 1) {
            const bit = getBitAt(bitIndex);
            d[i + c] = (d[i + c] & 0xfe) | bit;
            bitIndex += 1;
          }
        }

        return output;
      }

      function extractMessageLSB(sourceImageData) {
        const d = sourceImageData.data;
        const { capacityBits, usableBytes } = getLSBCapacityInfo(sourceImageData);
        if (capacityBits < LSB_HEADER_BITS) {
          throw new Error("目前影像容量不足，無法讀取 LSB 標頭。");
        }
        let bitCount = 0;

        function nextBit() {
          const pixelIndex = Math.floor(bitCount / 3);
          const channelIndex = bitCount % 3;
          const byteIndex = pixelIndex * 4 + channelIndex;
          if (byteIndex >= d.length) {
            throw new Error("位元讀取失敗：資料不足。");
          }
          bitCount += 1;
          return d[byteIndex] & 1;
        }

        let messageLength = 0;
        for (let i = 0; i < LSB_HEADER_BITS; i += 1) {
          messageLength = ((messageLength << 1) | nextBit()) >>> 0;
        }

        if (messageLength === 0) return "";
        if (messageLength > usableBytes) {
          throw new Error("讀到不合理的訊息長度，可能尚未寫入隱寫資料或資料已損毀。");
        }

        const bytes = new Uint8Array(messageLength);
        for (let i = 0; i < messageLength; i += 1) {
          let byteValue = 0;
          for (let b = 0; b < 8; b += 1) {
            byteValue = (byteValue << 1) | nextBit();
          }
          bytes[i] = byteValue;
        }

        const decoder = new TextDecoder("utf-8", { fatal: false });
        return decoder.decode(bytes);
      }

      function applyWatermark(sourceImageData, watermarkText, position, alpha) {
        if (!watermarkText.trim()) {
          throw new Error("請先輸入水印文字。");
        }

        const width = sourceImageData.width;
        const height = sourceImageData.height;
        const layerCanvas = document.createElement("canvas");
        layerCanvas.width = width;
        layerCanvas.height = height;
        const layerCtx = layerCanvas.getContext("2d", { willReadFrequently: true });
        layerCtx.clearRect(0, 0, width, height);

        const fontSize = Math.max(22, Math.round(Math.min(width, height) * 0.1));
        layerCtx.font = `700 ${fontSize}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
        layerCtx.textBaseline = "top";
        layerCtx.fillStyle = "rgba(255, 247, 190, 1)";
        layerCtx.shadowColor = "rgba(0, 0, 0, 0.7)";
        layerCtx.shadowBlur = 8;
        layerCtx.shadowOffsetX = 2;
        layerCtx.shadowOffsetY = 2;

        const metrics = layerCtx.measureText(watermarkText);
        const textWidth = metrics.width;
        const textHeight = Math.max(
          fontSize,
          (metrics.actualBoundingBoxAscent || fontSize * 0.75) +
            (metrics.actualBoundingBoxDescent || fontSize * 0.25)
        );
        const pad = Math.max(16, Math.round(Math.min(width, height) * 0.04));

        let x = pad;
        let y = pad;
        if (position === "top-right") {
          x = width - textWidth - pad;
          y = pad;
        } else if (position === "bottom-left") {
          x = pad;
          y = height - textHeight - pad;
        } else if (position === "bottom-right") {
          x = width - textWidth - pad;
          y = height - textHeight - pad;
        } else if (position === "center") {
          x = (width - textWidth) / 2;
          y = (height - textHeight) / 2;
        }

        layerCtx.fillText(watermarkText, Math.max(0, x), Math.max(0, y));
        const layerData = layerCtx.getImageData(0, 0, width, height);
        // 釋放暫存 canvas 記憶體
        layerCanvas.width = 0;
        layerCanvas.height = 0;

        const output = cloneImageData(sourceImageData);
        const src = sourceImageData.data;
        const lay = layerData.data;
        const out = output.data;

        for (let i = 0; i < out.length; i += CHANNELS) {
          const layerAlpha = (lay[i + 3] / 255) * alpha;
          if (layerAlpha <= 0) {
            out[i] = src[i];
            out[i + 1] = src[i + 1];
            out[i + 2] = src[i + 2];
            out[i + 3] = src[i + 3];
            continue;
          }

          out[i] = clampByte((1 - layerAlpha) * src[i] + layerAlpha * lay[i]);
          out[i + 1] = clampByte((1 - layerAlpha) * src[i + 1] + layerAlpha * lay[i + 1]);
          out[i + 2] = clampByte((1 - layerAlpha) * src[i + 2] + layerAlpha * lay[i + 2]);
          out[i + 3] = src[i + 3];
        }

        return output;
      }

      function getSpatialFilterModeLabel(mode) {
        if (mode === "sharpen") return "銳化";
        if (mode === "edge") return "邊緣偵測";
        return "高斯模糊";
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

      async function applyConvolution(sourceImageData, kernel, options = {}) {
        const width = sourceImageData.width;
        const height = sourceImageData.height;
        const kernelHeight = kernel.length;
        const kernelWidth = kernel[0].length;
        const halfY = Math.floor(kernelHeight / 2);
        const halfX = Math.floor(kernelWidth / 2);
        const grayscale = Boolean(options.grayscale);
        const bias = Number.isFinite(options.bias) ? options.bias : 0;

        // 嘗試使用 GPU.js 加速
        try {
          await new Promise(r => setTimeout(r, 0));

          let gpu;
          try {
            gpu = getGlobalGPU();
          } catch (gpuInitErr) {
            console.warn("[Convolution] GPU 初始化失敗，改用 CPU：", gpuInitErr.message || gpuInitErr);
            gpu = null;
          }
          if (!gpu) {
            throw new Error("GPU not available");
          }

          // 將 ImageData 轉換為 RGBA 平面陣列
          const srcData = sourceImageData.data;
          const flatRGBA = new Float32Array(srcData.length);
          for (let i = 0; i < srcData.length; i += 1) {
            flatRGBA[i] = srcData[i];
          }

          // 將 kernel 扁平化
          const flatKernel = [];
          for (let ky = 0; ky < kernelHeight; ky += 1) {
            for (let kx = 0; kx < kernelWidth; kx += 1) {
              flatKernel.push(kernel[ky][kx]);
            }
          }

          // 嘗試建立並編譯 Kernel
          let kernelFn;
          try {
            kernelFn = gpu.createKernel(
              grayscale
                ? function(value, flatKernel, kw, kh, hx, hy, w, h, bias, grayscaleFlag) {
                    const x = this.thread.x;
                    const y = this.thread.y;
                    let sumR = 0;
                    for (let ky = 0; ky < kh; ky += 1) {
                      const py = ky >= hy ? (y + ky - hy < h ? y + ky - hy : h - 1) : (y + ky - hy >= 0 ? y + ky - hy : 0);
                      for (let kx = 0; kx < kw; kx += 1) {
                        const px = kx >= hx ? (x + kx - hx < w ? x + kx - hx : w - 1) : (x + kx - hx >= 0 ? x + kx - hx : 0);
                        const idx = (py * w + px) * 4;
                        const luma = 0.299 * value[idx] + 0.587 * value[idx + 1] + 0.114 * value[idx + 2];
                        const weight = flatKernel[ky * kw + kx];
                        sumR += luma * weight;
                      }
                    }
                    const clampedValue = Math.min(255, Math.max(0, Math.round(sumR + bias)));
                    return clampedValue;
                  }
                : function(value, flatKernel, kw, kh, hx, hy, w, h, bias, grayscaleFlag) {
                    const x = this.thread.x;
                    const y = this.thread.y;
                    let sumR = 0;
                    let sumG = 0;
                    let sumB = 0;
                    for (let ky = 0; ky < kh; ky += 1) {
                      const py = ky >= hy ? (y + ky - hy < h ? y + ky - hy : h - 1) : (y + ky - hy >= 0 ? y + ky - hy : 0);
                      for (let kx = 0; kx < kw; kx += 1) {
                        const px = kx >= hx ? (x + kx - hx < w ? x + kx - hx : w - 1) : (x + kx - hx >= 0 ? x + kx - hx : 0);
                        const idx = (py * w + px) * 4;
                        const weight = flatKernel[ky * kw + kx];
                        sumR += value[idx] * weight;
                        sumG += value[idx + 1] * weight;
                        sumB += value[idx + 2] * weight;
                      }
                    }
                    return [
                      Math.min(255, Math.max(0, Math.round(sumR + bias))),
                      Math.min(255, Math.max(0, Math.round(sumG + bias))),
                      Math.min(255, Math.max(0, Math.round(sumB + bias))),
                      value[(y * w + x) * 4 + 3]
                    ];
                  },
              {
                output: [width, height],
                tactic: "speed"
              }
            );
          } catch (compileErr) {
            throw compileErr;
          }

          // 執行 GPU Kernel
          const gpuResult = kernelFn(flatRGBA, flatKernel, kernelWidth, kernelHeight, halfX, halfY, width, height, bias, grayscale);

          // 將結果轉換回 ImageData
          const outData = new Uint8ClampedArray(width * height * 4);
          if (grayscale) {
            for (let y = 0; y < height; y += 1) {
              for (let x = 0; x < width; x += 1) {
                const idx = (y * width + x) * 4;
                const val = Math.round(gpuResult[y][x]);
                outData[idx] = val;
                outData[idx + 1] = val;
                outData[idx + 2] = val;
                outData[idx + 3] = srcData[idx + 3];
              }
            }
          } else {
            for (let y = 0; y < height; y += 1) {
              for (let x = 0; x < width; x += 1) {
                const idx = (y * width + x) * 4;
                const pixel = gpuResult[y][x];
                outData[idx] = pixel[0];
                outData[idx + 1] = pixel[1];
                outData[idx + 2] = pixel[2];
                outData[idx + 3] = pixel[3];
              }
            }
          }

          return new ImageData(outData, width, height);

        } catch (gpuErr) {
          // GPU 不可用或編譯失敗，使用 CPU Fallback
          const output = cloneImageData(sourceImageData);
          const src = sourceImageData.data;
          const out = output.data;

          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              let sumR = 0;
              let sumG = 0;
              let sumB = 0;
              for (let ky = 0; ky < kernelHeight; ky += 1) {
                const py = Math.min(height - 1, Math.max(0, y + ky - halfY));
                for (let kx = 0; kx < kernelWidth; kx += 1) {
                  const px = Math.min(width - 1, Math.max(0, x + kx - halfX));
                  const idx = (py * width + px) * 4;
                  const weight = kernel[ky][kx];
                  if (grayscale) {
                    const luma = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
                    sumR += luma * weight;
                  } else {
                    sumR += src[idx] * weight;
                    sumG += src[idx + 1] * weight;
                    sumB += src[idx + 2] * weight;
                  }
                }
              }

              const outIndex = (y * width + x) * 4;
              if (grayscale) {
                const value = Math.min(255, Math.max(0, Math.round(sumR + bias)));
                out[outIndex] = value;
                out[outIndex + 1] = value;
                out[outIndex + 2] = value;
              } else {
                out[outIndex] = Math.min(255, Math.max(0, Math.round(sumR + bias)));
                out[outIndex + 1] = Math.min(255, Math.max(0, Math.round(sumG + bias)));
                out[outIndex + 2] = Math.min(255, Math.max(0, Math.round(sumB + bias)));
              }
              out[outIndex + 3] = src[outIndex + 3];
            }
          }

          return output;
        }
      }

      function applyEdgeDetection(sourceImageData, strength) {
        const output = cloneImageData(sourceImageData);
        const src = sourceImageData.data;
        const out = output.data;
        const width = sourceImageData.width;
        const height = sourceImageData.height;
        const gxKernel = [
          [-1, 0, 1],
          [-2, 0, 2],
          [-1, 0, 1]
        ];
        const gyKernel = [
          [-1, -2, -1],
          [0, 0, 0],
          [1, 2, 1]
        ];
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

            const magnitude = Math.hypot(gradX, gradY) * boost;
            const value = clampByte(Math.min(255, magnitude));
            const outIndex = (y * width + x) * CHANNELS;
            out[outIndex] = value;
            out[outIndex + 1] = value;
            out[outIndex + 2] = value;
            out[outIndex + 3] = src[outIndex + 3];
          }
        }

        return output;
      }

      function imageDataToGrayFloatBuffer(sourceImageData) {
        const gray = new Float32Array(sourceImageData.width * sourceImageData.height);
        const src = sourceImageData.data;
        for (let i = 0, j = 0; i < src.length; i += CHANNELS, j += 1) {
          gray[j] = rgbaToLuma(src[i], src[i + 1], src[i + 2]);
        }
        return gray;
      }

      function buildCannyGaussianKernel(blurStrength) {
        const safeBlur = clamp(Math.round(blurStrength) || 3, 1, 5);
        const radius = safeBlur;
        const sigma = 0.65 + safeBlur * 0.45;
        const size = radius * 2 + 1;
        const kernel = new Float32Array(size);
        let sum = 0;

        for (let i = 0; i < size; i += 1) {
          const offset = i - radius;
          const weight = Math.exp(-(offset * offset) / (2 * sigma * sigma));
          kernel[i] = weight;
          sum += weight;
        }

        if (sum > 0) {
          for (let i = 0; i < size; i += 1) {
            kernel[i] /= sum;
          }
        }

        return {
          blurStrength: safeBlur,
          radius,
          sigma,
          size,
          kernel
        };
      }

      function applySeparableGaussianBlur(grayValues, width, height, kernelInfo) {
        const { kernel, radius } = kernelInfo;
        const horizontal = new Float32Array(grayValues.length);
        const output = new Float32Array(grayValues.length);

        for (let y = 0; y < height; y += 1) {
          const rowOffset = y * width;
          for (let x = 0; x < width; x += 1) {
            let sum = 0;
            for (let k = -radius; k <= radius; k += 1) {
              const sampleX = clamp(x + k, 0, width - 1);
              sum += grayValues[rowOffset + sampleX] * kernel[k + radius];
            }
            horizontal[rowOffset + x] = sum;
          }
        }

        for (let y = 0; y < height; y += 1) {
          const rowOffset = y * width;
          for (let x = 0; x < width; x += 1) {
            let sum = 0;
            for (let k = -radius; k <= radius; k += 1) {
              const sampleY = clamp(y + k, 0, height - 1);
              sum += horizontal[sampleY * width + x] * kernel[k + radius];
            }
            output[rowOffset + x] = sum;
          }
        }

        return output;
      }

      function computeSobelGradients(grayValues, width, height) {
        const magnitude = new Float32Array(grayValues.length);
        const direction = new Uint8Array(grayValues.length);

        for (let y = 1; y < height - 1; y += 1) {
          for (let x = 1; x < width - 1; x += 1) {
            const idx = y * width + x;
            const topLeft = grayValues[idx - width - 1];
            const top = grayValues[idx - width];
            const topRight = grayValues[idx - width + 1];
            const left = grayValues[idx - 1];
            const right = grayValues[idx + 1];
            const bottomLeft = grayValues[idx + width - 1];
            const bottom = grayValues[idx + width];
            const bottomRight = grayValues[idx + width + 1];

            const gradX =
              -topLeft - 2 * left - bottomLeft +
              topRight + 2 * right + bottomRight;
            const gradY =
              -topLeft - 2 * top - topRight +
              bottomLeft + 2 * bottom + bottomRight;
            const angle = ((Math.atan2(gradY, gradX) * 180) / Math.PI + 180) % 180;

            magnitude[idx] = Math.hypot(gradX, gradY);
            if (angle < 22.5 || angle >= 157.5) {
              direction[idx] = 0;
            } else if (angle < 67.5) {
              direction[idx] = 1;
            } else if (angle < 112.5) {
              direction[idx] = 2;
            } else {
              direction[idx] = 3;
            }
          }
        }

        return { magnitude, direction };
      }

      function applyNonMaximumSuppression(magnitude, direction, width, height) {
        const suppressed = new Float32Array(magnitude.length);

        for (let y = 1; y < height - 1; y += 1) {
          for (let x = 1; x < width - 1; x += 1) {
            const idx = y * width + x;
            const current = magnitude[idx];
            let neighborA = 0;
            let neighborB = 0;

            switch (direction[idx]) {
              case 0:
                neighborA = magnitude[idx - 1];
                neighborB = magnitude[idx + 1];
                break;
              case 1:
                neighborA = magnitude[idx - width - 1];
                neighborB = magnitude[idx + width + 1];
                break;
              case 2:
                neighborA = magnitude[idx - width];
                neighborB = magnitude[idx + width];
                break;
              default:
                neighborA = magnitude[idx - width + 1];
                neighborB = magnitude[idx + width - 1];
                break;
            }

            if (current >= neighborA && current >= neighborB) {
              suppressed[idx] = current;
            }
          }
        }

        return suppressed;
      }

      function normalizeMagnitudeBuffer(values) {
        let maxValue = 0;
        for (let i = 0; i < values.length; i += 1) {
          if (values[i] > maxValue) {
            maxValue = values[i];
          }
        }

        const normalized = new Uint8Array(values.length);
        if (maxValue <= 1e-6) {
          return { values: normalized, maxValue: 0 };
        }

        const scale = 255 / maxValue;
        for (let i = 0; i < values.length; i += 1) {
          normalized[i] = clampByte(values[i] * scale);
        }
        return { values: normalized, maxValue };
      }

      function applyDoubleThreshold(values, lowThreshold, highThreshold) {
        const classified = new Uint8Array(values.length);
        let strongCount = 0;

        for (let i = 0; i < values.length; i += 1) {
          const value = values[i];
          if (value >= highThreshold) {
            classified[i] = 255;
            strongCount += 1;
          } else if (value >= lowThreshold) {
            classified[i] = CANNY_WEAK_EDGE_VALUE;
          }
        }

        return { classified, strongCount };
      }

      function trackEdgesByHysteresis(classified, width, height, initialStrongCount = 0) {
        const edgeMap = new Uint8Array(classified.length);
        const stack = new Uint32Array(classified.length);
        let stackSize = 0;
        let strongCount = 0;
        let linkedWeakCount = 0;

        for (let i = 0; i < classified.length; i += 1) {
          if (classified[i] === 255) {
            edgeMap[i] = 255;
            stack[stackSize] = i;
            stackSize += 1;
            strongCount += 1;
          }
        }

        while (stackSize > 0) {
          const idx = stack[stackSize - 1];
          stackSize -= 1;
          const x = idx % width;
          const y = Math.floor(idx / width);

          for (let dy = -1; dy <= 1; dy += 1) {
            const py = y + dy;
            if (py < 0 || py >= height) continue;
            for (let dx = -1; dx <= 1; dx += 1) {
              if (dx === 0 && dy === 0) continue;
              const px = x + dx;
              if (px < 0 || px >= width) continue;
              const neighborIndex = py * width + px;
              if (classified[neighborIndex] === CANNY_WEAK_EDGE_VALUE && edgeMap[neighborIndex] === 0) {
                edgeMap[neighborIndex] = 255;
                stack[stackSize] = neighborIndex;
                stackSize += 1;
                linkedWeakCount += 1;
              }
            }
          }
        }

        return {
          edgeMap,
          strongEdgeCount: Math.max(strongCount, initialStrongCount),
          linkedWeakCount,
          edgePixelCount: Math.max(strongCount, initialStrongCount) + linkedWeakCount
        };
      }

      function binaryEdgeMapToImageData(edgeMap, width, height) {
        const output = new ImageData(width, height);
        const dst = output.data;
        for (let i = 0, j = 0; j < edgeMap.length; i += CHANNELS, j += 1) {
          const value = edgeMap[j] ? 255 : 0;
          dst[i] = value;
          dst[i + 1] = value;
          dst[i + 2] = value;
          dst[i + 3] = 255;
        }
        return output;
      }

      async function runCannyEdgeDetection(sourceImageData, options = {}) {
        const width = sourceImageData.width;
        const height = sourceImageData.height;
        const blurStrength = clamp(Math.round(options.blurStrength) || 3, 1, 5);
        const lowThreshold = clamp(Math.round(options.lowThreshold) || 42, 10, 120);
        const highThreshold = clamp(Math.round(options.highThreshold) || 108, 40, 220);

        // ── Hybrid Pipeline：GPU 前處理 ─────────────────────────────────
        let gpuMagnitude = null;
        let gpuDirection = null;

        try {
          await new Promise(r => setTimeout(r, 0));

          let gpu;
          try {
            gpu = getGlobalGPU();
          } catch (gpuInitErr) {
            console.warn("[Canny GPU] GPU 初始化失敗，改用 CPU：", gpuInitErr.message || gpuInitErr);
            gpu = null;
          }
          if (!gpu) {
            throw new Error("GPU not available");
          }

          const srcData = sourceImageData.data;
          const flatRGBA = new Float32Array(srcData.length);
          for (let i = 0; i < srcData.length; i += 1) {
            flatRGBA[i] = srcData[i];
          }

          // Kernel 1：灰階轉換
          let kernelGray;
          try {
            kernelGray = gpu.createKernel(
              function(value, w, h) {
                const x = this.thread.x;
                const y = this.thread.y;
                const idx = (y * w + x) * 4;
                return 0.299 * value[idx] + 0.587 * value[idx + 1] + 0.114 * value[idx + 2];
              },
              { output: [width, height], tactic: "speed" }
            );
          } catch (compileErr) {
            throw compileErr;
          }
          let grayResult;
          try {
            grayResult = kernelGray(flatRGBA, width, height);
          } catch (runErr) {
            console.warn("[Canny GPU] kernelGray 執行失敗，改用 CPU：", runErr.message || runErr);
            throw runErr;
          }

          // 建立一維灰階 Float32Array 以便後續 Kernel 使用
          const flatGray = new Float32Array(width * height);
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              flatGray[y * width + x] = grayResult[y][x];
            }
          }

          // 建立高斯模糊 Kernel（可分離：水平 + 垂直）
          const safeBlur = blurStrength;
          const radius = safeBlur;
          const sigma = 0.65 + safeBlur * 0.45;
          const kSize = radius * 2 + 1;
          const gaussKernel = new Float32Array(kSize);
          let kSum = 0;
          for (let i = 0; i < kSize; i += 1) {
            const offset = i - radius;
            const weight = Math.exp(-(offset * offset) / (2 * sigma * sigma));
            gaussKernel[i] = weight;
            kSum += weight;
          }
          for (let i = 0; i < kSize; i += 1) {
            gaussKernel[i] /= kSum;
          }

          // Kernel 2：水平高斯模糊（gray → horizontal）
          let kernelBlurH;
          try {
            kernelBlurH = gpu.createKernel(
              function(gray, w, h, kernel, kr) {
                const x = this.thread.x;
                const y = this.thread.y;
                let sum = 0;
                for (let k = -kr; k <= kr; k += 1) {
                  const sx = k >= 0 ? (x + k < w ? x + k : w - 1) : (x + k >= 0 ? x + k : 0);
                  sum += gray[y * w + sx] * kernel[k + kr];
                }
                return sum;
              },
              { output: [width, height], tactic: "speed" }
            );
          } catch (compileErr) {
            throw compileErr;
          }
          let blurHResult;
          try {
            blurHResult = kernelBlurH(flatGray, width, height, gaussKernel, radius);
          } catch (runErr) {
            console.warn("[Canny GPU] kernelBlurH 執行失敗，改用 CPU：", runErr.message || runErr);
            throw runErr;
          }

          // 建立水平模糊結果的一維陣列
          const flatBlurH = new Float32Array(width * height);
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              flatBlurH[y * width + x] = blurHResult[y][x];
            }
          }

          // Kernel 3：垂直高斯模糊（horizontal → blurredGray）
          let kernelBlurV;
          try {
            kernelBlurV = gpu.createKernel(
              function(horizontal, w, h, kernel, kr) {
                const x = this.thread.x;
                const y = this.thread.y;
                let sum = 0;
                for (let k = -kr; k <= kr; k += 1) {
                  const sy = k >= 0 ? (y + k < h ? y + k : h - 1) : (y + k >= 0 ? y + k : 0);
                  sum += horizontal[sy * w + x] * kernel[k + kr];
                }
                return sum;
              },
              { output: [width, height], tactic: "speed" }
            );
          } catch (compileErr) {
            throw compileErr;
          }
          let blurredGrayResult;
          try {
            blurredGrayResult = kernelBlurV(flatBlurH, width, height, gaussKernel, radius);
          } catch (runErr) {
            console.warn("[Canny GPU] kernelBlurV 執行失敗，改用 CPU：", runErr.message || runErr);
            throw runErr;
          }

          // 建立模糊後灰階的一維陣列（用於 Sobel Kernel）
          const flatBlurred = new Float32Array(width * height);
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              flatBlurred[y * width + x] = blurredGrayResult[y][x];
            }
          }

          // Kernel 4：Sobel 梯度計算 → magnitude + direction（量化為 0,1,2,3）
          let kernelSobel;
          try {
            kernelSobel = gpu.createKernel(
              function(gray, w, h) {
                const x = this.thread.x;
                const y = this.thread.y;
                if (x < 1 || x >= w - 1 || y < 1 || y >= h - 1) {
                  return [0, 0];
                }
                const idx = y * w + x;
                const topLeft = gray[idx - w - 1];
                const top = gray[idx - w];
                const topRight = gray[idx - w + 1];
                const left = gray[idx - 1];
                const right = gray[idx + 1];
                const bottomLeft = gray[idx + w - 1];
                const bottom = gray[idx + w];
                const bottomRight = gray[idx + w + 1];

                const gradX = -topLeft - 2 * left - bottomLeft + topRight + 2 * right + bottomRight;
                const gradY = -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight;
                const angle = ((Math.atan2(gradY, gradX) * 180) / Math.PI + 180) % 180;

                let direction;
                if (angle < 22.5 || angle >= 157.5) {
                  direction = 0;
                } else if (angle < 67.5) {
                  direction = 1;
                } else if (angle < 112.5) {
                  direction = 2;
                } else {
                  direction = 3;
                }

                return [Math.hypot(gradX, gradY), direction];
              },
              { output: [width, height], tactic: "speed" }
            );
          } catch (compileErr) {
            throw compileErr;
          }
          let sobelResult;
          try {
            sobelResult = kernelSobel(flatBlurred, width, height);
          } catch (runErr) {
            console.warn("[Canny GPU] kernelSobel 執行失敗，改用 CPU：", runErr.message || runErr);
            throw runErr;
          }

          // 收集 GPU 結果
          const magnitudeOut = new Float32Array(width * height);
          const directionOut = new Uint8Array(width * height);
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              const idx = y * width + x;
              const [mag, dir] = sobelResult[y][x];
              magnitudeOut[idx] = mag;
              directionOut[idx] = dir;
            }
          }
          gpuMagnitude = magnitudeOut;
          gpuDirection = directionOut;

        } catch (gpuErr) {
          // GPU 不可用或編譯失敗 → 無縫降級，全 CPU 流程
          console.warn("[Canny GPU] Fallback to CPU pipeline:", gpuErr.message || gpuErr);
        }

        // ── 交由 Worker 完成後半段 ─────────────────────────────────────
        return new Promise((resolve, reject) => {
          if (activeCannyWorker) {
            activeCannyWorker.terminate();
            activeCannyWorker = null;
          }

          const { worker, terminate } = createInlineWorker(CANNY_WORKER_SOURCE);
          activeCannyWorker = { terminate };

          const handleMessage = (ev) => {
            const {
              resultData,
              width: resultWidth,
              height: resultHeight,
              blurStrength: resultBlur,
              lowThreshold: resultLow,
              highThreshold: resultHigh,
              strongEdgeCount,
              linkedWeakCount,
              edgePixelCount,
              kernelSize,
              sigma
            } = ev.data;

            worker.removeEventListener("message", handleMessage);
            worker.removeEventListener("error", handleError);

            const resultImageData = new ImageData(
              new Uint8ClampedArray(resultData),
              resultWidth,
              resultHeight
            );

            resolve({
              resultImageData,
              blurStrength: resultBlur,
              lowThreshold: resultLow,
              highThreshold: resultHigh,
              strongEdgeCount,
              linkedWeakCount,
              edgePixelCount,
              edgeDensity: edgePixelCount / Math.max(1, resultWidth * resultHeight),
              kernelSize,
              sigma
            });

            // 延後 100ms 終止 Worker，防止瀏覽器過早回收記憶體導致畫面閃爍
            setTimeout(() => {
              terminate();
              activeCannyWorker = null;
            }, 100);
          };

          const handleError = (err) => {
            worker.removeEventListener("message", handleMessage);
            worker.removeEventListener("error", handleError);
            terminate();
            activeCannyWorker = null;
            reject(err);
          };

          worker.addEventListener("message", handleMessage);
          worker.addEventListener("error", handleError);

          if (gpuMagnitude && gpuDirection) {
            // GPU 加速軌：直接傳遞預處理結果，Worker 跳過前三步
            worker.postMessage(
              {
                magnitude: gpuMagnitude,
                direction: gpuDirection,
                width,
                height,
                blurStrength,
                lowThreshold,
                highThreshold
              },
              [gpuMagnitude.buffer, gpuDirection.buffer]
            );
          } else {
            // CPU Fallback 軌：原始 ImageData，Worker 走完整 5 步
            worker.postMessage(
              {
                imageData: Array.from(sourceImageData.data),
                width,
                height,
                blurStrength,
                lowThreshold,
                highThreshold
              }
            );
          }
        });
      }

      function getFFTModeLabel(mode) {
        if (mode === "lowpass") return "低通濾波";
        if (mode === "highpass") return "高通濾波";
        return "頻譜";
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
            const real = reRows[sourceY][sourceX];
            const imag = imRows[sourceY][sourceX];
            const value = Math.log1p(Math.hypot(real, imag));
            logMagnitude[rowOffset + sx] = value;
            if (value < minLog) minLog = value;
            if (value > maxLog) maxLog = value;
          }
        }

        return {
          width,
          height,
          logMagnitude,
          minLog: Number.isFinite(minLog) ? minLog : 0,
          maxLog
        };
      }

      async function ensureFFTCache(baseImageData) {
        if (fftCache && fftCache.baseImageData === baseImageData) {
          return fftCache;
        }

        const width = FFT_WORK_WIDTH;
        const height = FFT_WORK_HEIGHT;
        const grayBuffer = imageDataToGrayBuffer(baseImageData, width, height);

        fftCache = {
          baseImageData,
          width,
          height,
          grayBuffer
        };
        return fftCache;
      }

      function buildFFTPreviewResult(cache, mode, strengthValue, workerResult) {
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

      async function previewFFT(options = {}) {
        const requestId = ++fftPreviewRequestId;
        const mode = fftMode;
        const strength = Number(fftStrengthInput.value);
        setTransientLoading(true, "FFT 預覽計算中...");
        try {
          return await setToolPreviewAsync(
            "fft",
            async (baseImageData) => {
              const cache = await ensureFFTCache(baseImageData);

              const workerResult = await new Promise((resolve, reject) => {
                // 終止舊的 FFT Worker，防止孤兒運算
                if (activeFftWorker) {
                  activeFftWorker.terminate();
                  activeFftWorker = null;
                }

                const { worker, terminate } = createInlineWorker(FFT_WORKER_SOURCE);
                activeFftWorker = { terminate };

                const handleMessage = (e) => {
                  worker.removeEventListener("message", handleMessage);
                  worker.removeEventListener("error", handleError);
                  resolve(e.data);
                  // 延後 100ms 終止 Worker，防止瀏覽器過早回收記憶體導致畫面閃爍
                  setTimeout(() => {
                    terminate();
                    activeFftWorker = null;
                  }, 100);
                };

                const handleError = (err) => {
                  worker.removeEventListener("message", handleMessage);
                  worker.removeEventListener("error", handleError);
                  terminate();
                  activeFftWorker = null;
                  reject(err);
                };

                worker.addEventListener("message", handleMessage);
                worker.addEventListener("error", handleError);

                worker.postMessage({
                  grayBuffer: Array.from(cache.grayBuffer),
                  width: cache.width,
                  height: cache.height,
                  mode,
                  strengthValue: strength
                });
              });

              if (options.isStale && options.isStale()) {
                return null;
              }

              const resultImageData = buildFFTPreviewResult(cache, mode, strength, workerResult);
              return {
                imageData: resultImageData,
                resultImageData,
                mode,
                strength
              };
            },
            {
              suppressStatus: options.suppressStatus,
              showError: options.showError,
              toastError: options.toastError,
              ensureImageOptions: {
                toast: Boolean(options.ensureToast),
                message: "請先載入圖片 A。",
                toastMessage: "請先載入圖片 A。"
              },
              isStale() {
                return requestId !== fftPreviewRequestId;
              },
              onPreviewReady(built) {
                fftPreviewInfo = built
                  ? {
                      resultImageData: built.resultImageData,
                      mode: built.mode,
                      strength: built.strength
                    }
                  : null;
                pcaPreviewInfo = null;
                updatePCAMetrics(null);
              },
              onPreviewCleared() {
                fftPreviewInfo = null;
              },
              previewStatusType: mode === "spectrum" ? "info" : "warn",
              previewMessage() {
                return `FFT 預覽中（${getFFTModeLabel(mode)}，強度 ${strength}），按「套用 FFT」確認。`;
              },
              previewToast: !options.suppressStatus && options.ensureToast
                ? () => ({
                    type: mode === "spectrum" ? "info" : "warn",
                    title: "FFT 預覽已建立",
                    message:
                      mode === "spectrum"
                        ? "已顯示頻譜圖，可再拖曳強度調整顯示範圍。"
                        : `已建立 ${getFFTModeLabel(mode)}預覽，強度 ${strength}。`
                  })
                : null
            }
          );
        } finally {
          setTransientLoading(false);
          updateWorkspaceControls();
        }
      }

      async function buildCovarianceMatrix(centeredRows, width, height) {
        const denom = Math.max(1, height - 1);

        // 嘗試使用 GPU.js 加速
        try {
          await new Promise(r => setTimeout(r, 0));

          let gpu;
          try {
            gpu = getGlobalGPU();
          } catch (gpuInitErr) {
            console.warn("[PCA GPU] GPU 初始化失敗，改用 CPU：", gpuInitErr.message || gpuInitErr);
            gpu = null;
          }
          if (!gpu) {
            throw new Error("GPU not available");
          }

          // 將 centeredRows 轉換為 Float32Array 平面格式
          const flatData = new Float32Array(width * height);
          for (let y = 0; y < height; y += 1) {
            const row = centeredRows[y];
            for (let x = 0; x < width; x += 1) {
              flatData[y * width + x] = row[x];
            }
          }

          // 嘗試建立並編譯 Kernel
          let kernelFn;
          try {
            kernelFn = gpu.createKernel(
              function(data, w, h, denominator) {
                const i = this.thread.x;
                const j = this.thread.y;
                let sum = 0;
                for (let y = 0; y < h; y += 1) {
                  sum += data[y * w + i] * data[y * w + j];
                }
                return sum / denominator;
              },
              {
                output: [width, width],
                tactic: "speed"
              }
            );
          } catch (compileErr) {
            throw compileErr;
          }

          // 執行 GPU Kernel（加 try-catch 防止編譯成功但執行失敗）
          let gpuResult;
          try {
            gpuResult = kernelFn(flatData, width, height, denom);
          } catch (runErr) {
            console.warn("[PCA GPU] 矩陣乘法 Kernel 執行失敗，改用 CPU：", runErr.message || runErr);
            throw runErr;
          }

          // 將結果轉換回 2D Float64Array
          const covariance = Array.from({ length: width }, () => new Float64Array(width));
          for (let y = 0; y < width; y += 1) {
            for (let x = 0; x < width; x += 1) {
              covariance[y][x] = gpuResult[y][x];
            }
          }

          return covariance;

        } catch (gpuErr) {
          // GPU 不可用或編譯失敗，使用 CPU Fallback
          const covariance = Array.from({ length: width }, () => new Float64Array(width));
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
        return {
          eigenvalues: sortedValues,
          eigenvectors: sortedVectors
        };
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

      async function ensurePCACache(baseImageData) {
        if (pcaCache && pcaCache.baseImageData === baseImageData) {
          return pcaCache;
        }

        // PCA is solved on a downsampled grayscale matrix so we keep true decomposition while staying interactive.
        // Each row of the reduced grayscale image is treated as one observation vector; we then decompose the
        // covariance matrix for an interactive approximation instead of running full-resolution RGB PCA.
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

        const covariance = await buildCovarianceMatrix(centeredRows, workSize.width, workSize.height);
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

        pcaCache = {
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
        return pcaCache;
      }

      function buildPCALatentImage(cache, componentCount) {
        const width = Math.max(1, componentCount);
        const height = cache.height;
        const values = new Float64Array(width * height);
        let maxAbs = 0;

        for (let y = 0; y < height; y += 1) {
          const scores = cache.scoresRows[y];
          const rowOffset = y * width;
          for (let x = 0; x < width; x += 1) {
            const value = scores[x];
            values[rowOffset + x] = value;
            maxAbs = Math.max(maxAbs, Math.abs(value));
          }
        }

        if (!Number.isFinite(maxAbs) || maxAbs < 1e-8) {
          values.fill(128);
        } else {
          for (let i = 0; i < values.length; i += 1) {
            values[i] = clamp(128 + (values[i] / maxAbs) * 127, 0, 255);
          }
        }
        return grayBufferToImageData(values, width, height);
      }

      function buildPCAPreviewResult(cache, retentionPercent) {
        const safeRetention = clamp(retentionPercent, 10, 95);
        const componentCount = Math.max(1, Math.min(cache.rank, Math.ceil((cache.rank * safeRetention) / 100)));
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

        const latentImageData = buildPCALatentImage(cache, componentCount);
        const resultImageData = grayBufferToCanvasSizedImageData(
          reconstruction,
          cache.width,
          cache.height,
          cache.baseImageData.width,
          cache.baseImageData.height
        );
        const originalElements = cache.width * cache.height;
        const compressedElements = cache.height * componentCount + cache.width * componentCount + cache.width;
        return {
          resultImageData,
          latentImageData,
          componentCount,
          compressionRatio: originalElements / Math.max(1, compressedElements),
          infoRetention: cache.totalVariance > 0 ? keptVariance / cache.totalVariance : 1
        };
      }

      async function previewPCA(options = {}) {
        const requestId = ++pcaPreviewRequestId;
        const retentionPercent = Number(pcaRetentionInput.value);
        setTransientLoading(true, "PCA 預覽計算中...");
        try {
          return await setToolPreviewAsync(
            "pca",
            async (baseImageData) => {
              const cache = await ensurePCACache(baseImageData);
              const result = buildPCAPreviewResult(cache, retentionPercent);
              return {
                imageData: result.resultImageData,
                resultImageData: result.resultImageData,
                latentImageData: result.latentImageData,
                compressionRatio: result.compressionRatio,
                infoRetention: result.infoRetention,
                retentionPercent,
                componentCount: result.componentCount
              };
            },
            {
              suppressStatus: options.suppressStatus,
              showError: options.showError,
              toastError: options.toastError,
              ensureImageOptions: {
                toast: Boolean(options.ensureToast),
                message: "請先載入圖片 A。",
                toastMessage: "請先載入圖片 A。"
              },
              isStale() {
                return requestId !== pcaPreviewRequestId;
              },
              onPreviewReady(built) {
                pcaPreviewInfo = built
                  ? {
                      resultImageData: built.resultImageData,
                      latentImageData: built.latentImageData,
                      compressionRatio: built.compressionRatio,
                      infoRetention: built.infoRetention,
                      retentionPercent: built.retentionPercent,
                      componentCount: built.componentCount
                    }
                  : null;
                fftPreviewInfo = null;
              },
              onPreviewCleared() {
                pcaPreviewInfo = null;
                updatePCAMetrics(null);
              },
              previewStatusType: "warn",
              previewMessage(built) {
                const metricText =
                  built && Number.isFinite(built.infoRetention)
                    ? `，估計資訊保留 ${formatPercent(built.infoRetention)}`
                    : "";
                return `PCA 預覽中（保留 ${retentionPercent}% 主成分${metricText}），按「套用 PCA」確認。`;
              },
              previewToast: !options.suppressStatus && options.ensureToast
                ? (built) => ({
                    type: "warn",
                    title: "PCA 預覽已建立",
                    message:
                      built && Number.isFinite(built.compressionRatio)
                        ? `保留 ${retentionPercent}% 主成分，壓縮比 ${formatRatio(built.compressionRatio)}，資訊保留 ${formatPercent(built.infoRetention)}。`
                        : `已建立 PCA 重建預覽，保留 ${retentionPercent}% 主成分。`
                  })
                : null
            }
          );
        } finally {
          setTransientLoading(false);
          updateWorkspaceControls();
        }
      }

      async function previewCanny(options = {}) {
        const requestId = ++cannyPreviewRequestId;
        const settings = getCannyControlSettings();
        setTransientLoading(true, "Canny 預覽計算中...");
        try {
          return await setToolPreviewAsync(
            "canny",
            async (baseImageData) => {
              const result = await runCannyEdgeDetection(baseImageData, settings);
              return {
                imageData: result.resultImageData,
                resultImageData: result.resultImageData,
                blurStrength: result.blurStrength,
                lowThreshold: result.lowThreshold,
                highThreshold: result.highThreshold,
                strongEdgeCount: result.strongEdgeCount,
                linkedWeakCount: result.linkedWeakCount,
                edgePixelCount: result.edgePixelCount,
                edgeDensity: result.edgeDensity,
                kernelSize: result.kernelSize,
                sigma: result.sigma
              };
            },
            {
              suppressStatus: options.suppressStatus,
              showError: options.showError,
              toastError: options.toastError,
              ensureImageOptions: {
                toast: Boolean(options.ensureToast),
                message: "請先載入圖片 A。",
                toastMessage: "請先載入圖片 A。"
              },
              isStale() {
                return requestId !== cannyPreviewRequestId;
              },
              onPreviewReady(built) {
                cannyPreviewInfo = built
                  ? {
                      resultImageData: built.resultImageData,
                      blurStrength: built.blurStrength,
                      lowThreshold: built.lowThreshold,
                      highThreshold: built.highThreshold,
                      strongEdgeCount: built.strongEdgeCount,
                      linkedWeakCount: built.linkedWeakCount,
                      edgePixelCount: built.edgePixelCount,
                      edgeDensity: built.edgeDensity,
                      kernelSize: built.kernelSize,
                      sigma: built.sigma
                    }
                  : null;
              },
              onPreviewCleared() {
                cannyPreviewInfo = null;
                updateCannyMetrics(null);
              },
              previewStatusType: "warn",
              previewMessage(built) {
                const densityText =
                  built && Number.isFinite(built.edgeDensity)
                    ? `，邊緣密度 ${formatPercent(built.edgeDensity)}`
                    : "";
                return `Canny 預覽中（blur ${settings.blurStrength}，low ${settings.lowThreshold}，high ${settings.highThreshold}${densityText}），按「套用 Canny」確認。`;
              },
              previewToast: !options.suppressStatus && options.ensureToast
                ? (built) => ({
                    type: "warn",
                    title: "Canny 預覽已建立",
                    message:
                      built && Number.isFinite(built.edgePixelCount)
                        ? `已擷取 ${built.edgePixelCount.toLocaleString()} 個穩定邊緣像素，邊緣密度 ${formatPercent(built.edgeDensity)}。`
                        : `已建立 Canny 預覽（blur ${settings.blurStrength}，low ${settings.lowThreshold}，high ${settings.highThreshold}）。`
                  })
                : null
            }
          );
        } finally {
          setTransientLoading(false);
          updateWorkspaceControls();
        }
      }

      function scheduleBCPreview(options = {}) {
        if (bcPreviewTimer) {
          clearTimeout(bcPreviewTimer);
        }
        bcPreviewTimer = window.setTimeout(() => {
          bcPreviewTimer = 0;
          previewBrightnessContrast(options);
        }, PREVIEW_DEBOUNCE_MS);
      }

      function scheduleBlendPreview(options = {}) {
        if (blendPreviewTimer) {
          clearTimeout(blendPreviewTimer);
        }
        blendPreviewTimer = window.setTimeout(() => {
          blendPreviewTimer = 0;
          previewBlend(options);
        }, PREVIEW_DEBOUNCE_MS);
      }

      function scheduleMosaicPreview(options = {}) {
        if (mosaicPreviewTimer) {
          clearTimeout(mosaicPreviewTimer);
        }
        mosaicPreviewTimer = window.setTimeout(() => {
          mosaicPreviewTimer = 0;
          previewMosaic(options);
        }, PREVIEW_DEBOUNCE_MS);
      }

      function scheduleWatermarkPreview(options = {}) {
        if (watermarkPreviewTimer) {
          clearTimeout(watermarkPreviewTimer);
        }
        watermarkPreviewTimer = window.setTimeout(() => {
          watermarkPreviewTimer = 0;
          previewWatermark(options);
        }, PREVIEW_DEBOUNCE_MS);
      }

      function scheduleSpatialFilterPreview(options = {}) {
        if (spatialFilterPreviewTimer) {
          clearTimeout(spatialFilterPreviewTimer);
        }
        spatialFilterPreviewTimer = window.setTimeout(() => {
          spatialFilterPreviewTimer = 0;
          previewSpatialFilter(options);
        }, options.delay ?? PREVIEW_DEBOUNCE_MS);
      }

      function scheduleFFTPreview(options = {}) {
        if (fftPreviewTimer) {
          clearTimeout(fftPreviewTimer);
        }
        fftPreviewTimer = window.setTimeout(() => {
          fftPreviewTimer = 0;
          void previewFFT(options);
        }, options.delay ?? PREVIEW_DEBOUNCE_MS);
      }

      function schedulePCAPreview(options = {}) {
        if (pcaPreviewTimer) {
          clearTimeout(pcaPreviewTimer);
        }
        pcaPreviewTimer = window.setTimeout(() => {
          pcaPreviewTimer = 0;
          void previewPCA(options);
        }, options.delay ?? PREVIEW_DEBOUNCE_MS);
      }

      function scheduleCannyPreview(options = {}) {
        if (cannyPreviewTimer) {
          clearTimeout(cannyPreviewTimer);
        }
        cannyPreviewTimer = window.setTimeout(() => {
          cannyPreviewTimer = 0;
          void previewCanny(options);
        }, options.delay ?? PREVIEW_DEBOUNCE_MS);
      }

      function restoreOriginal() {
        if (!originalImageData) {
          notifyStatus("沒有可復原的原始影像。", "warn", {
            title: "沒有可復原的原始圖",
            message: "請先載入圖片（A），才能復原原始內容。"
          });
          return;
        }
        const compareBase = currentImageData ? cloneImageData(currentImageData) : null;
        clearPreviewState();
        currentImageData = cloneImageData(originalImageData);
        captureCompareBaseImage(compareBase);
        compareViewMode = "normal";
        pushHistoryState("復原原始", currentImageData);
        refreshCanvasView();
        refreshMatrixView();
        notifyStatus("已復原到上傳後的原始 A 圖。", "ok", {
          title: "已復原原始圖",
          message: "目前影像已回到最初載入的 A 圖。"
        });
        updateWorkspaceControls();
      }

      function openCompareModal() {
        if (!ensureImageLoaded({ toast: true })) return false;
        const compareState = getCompareViewState();
        if (!compareState.hasRenderable) {
          return false;
        }
        compareViewMode = "split";
        refreshCanvasView();
        refreshMatrixView();
        notifyStatus("已開啟前後對比視窗。", "info", {
          title: "前後對比",
          message: "左側顯示套用前基底，右側顯示預覽或目前結果，並同步顯示雙邊矩陣。"
        });
        return true;
      }

      function closeCompareModal(options = {}) {
        const wasOpen = compareViewMode === "split";
        compareViewMode = "normal";
        renderCompareModal();
        updateWorkspaceControls();
        if (wasOpen && !options.silent) {
          notifyStatus("已關閉前後對比視窗。", "ok", {
            title: "已關閉前後對比",
            message: "主畫面維持目前結果檢視，其他功能不受影響。"
          });
        }
        return wasOpen;
      }

      function toggleCompareView(forceMode = null) {
        const nextMode = forceMode || (compareViewMode === "split" ? "normal" : "split");
        return nextMode === "split" ? openCompareModal() : closeCompareModal();
      }

      function timestampText() {
        const d = new Date();
        const pad2 = (v) => String(v).padStart(2, "0");
        const y = d.getFullYear();
        const m = pad2(d.getMonth() + 1);
        const day = pad2(d.getDate());
        const hh = pad2(d.getHours());
        const mm = pad2(d.getMinutes());
        const ss = pad2(d.getSeconds());
        return `${y}${m}${day}-${hh}${mm}${ss}`;
      }

      function exportPNG() {
        if (!ensureImageLoaded({ toast: true })) return;
        const mode = exportModeSelect.value;
        const fileName = `pixel-wizard-${timestampText()}.png`;
        const suffix = mode === "display" ? "（目前顯示）" : "（實際結果 RGB）";

        // 取得匯出來源（display 模式用 mainCanvas，否則用 ImageData）
        const renderSource = (callback) => {
          if (mode === "display") {
            callback(mainCanvas);
          } else {
            const source = getRenderableImageData();
            if (!source) {
              notifyStatus("目前沒有可匯出的影像資料。", "warn", {
                title: "沒有可匯出資料",
                message: "請先產生或載入可匯出的影像。"
              });
              return;
            }
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = source.width;
            tempCanvas.height = source.height;
            const tempCtx = tempCanvas.getContext("2d");
            tempCtx.putImageData(source, 0, 0);
            callback(tempCanvas);
          }
        };

        const doExport = (canvas) => {
          canvas.toBlob((blob) => {
            // 釋放暫存 canvas 記憶體
            if (canvas !== mainCanvas) {
              canvas.width = 0;
              canvas.height = 0;
            }
            if (!blob) {
              notifyStatus("PNG 匯出失敗（無法建立 Blob）。", "error", {
                title: "匯出失敗",
                message: "瀏覽器無法建立 PNG Blob，請稍後再試。"
              });
              return;
            }
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = fileName;
            a.click();
            // 釋放 Blob URL，避免記憶體洩漏
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            notifyStatus(
              mode === "display" ? "PNG 匯出完成（目前顯示）。" : "PNG 匯出完成（實際結果 RGB）。",
              "ok",
              {
                title: "匯出完成",
                message: `已匯出：${fileName}${suffix}`
              }
            );
          }, "image/png");
        };

        try {
          renderSource(doExport);
        } catch (err) {
          notifyStatus(err.message || "PNG 匯出失敗。", "error", {
            title: "匯出失敗",
            message: err.message || "無法完成 PNG 匯出，請稍後再試。"
          });
        }
      }

      function updateBCFormula() {
        const b = Number(brightnessInput.value);
        const c = Number(contrastInput.value);
        brightnessVal.textContent = String(b);
        contrastVal.textContent = c.toFixed(2);
        if (bcFormula) {
          bcFormula.innerHTML = `$I' = (I - 128) \\cdot ${c.toFixed(2)} + 128 + ${b}$`;
          typesetMath(bcFormula);
        }
      }

      function updateBlendFormula() {
        const alpha = Number(blendAlphaInput.value);
        const beta = 1 - alpha;
        blendAlphaVal.textContent = alpha.toFixed(2);
        if (blendFormula) {
          blendFormula.innerHTML = `$\\text{Out} = ${alpha.toFixed(2)}A + ${beta.toFixed(2)}B$`;
          typesetMath(blendFormula);
        }
      }

      function updateMosaicLabel() {
        blockSizeVal.textContent = blockSizeInput.value;
      }

      function updateWatermarkLabel() {
        watermarkAlphaVal.textContent = Number(watermarkAlphaInput.value).toFixed(2);
      }

      function updateSampleSizeLabel() {
        if (sampleSizeValue) {
          sampleSizeValue.textContent = String(sampleSizeN);
        }
      }

      async function buildSpatialFilterPreviewImage(baseImageData, mode, rawValue) {
        if (mode === "gaussian") {
          const size = Math.max(3, Math.min(9, Math.round(rawValue) | 1));
          const sigma = Math.max(0.85, size / 3);
          return applyConvolution(baseImageData, buildGaussianKernel(size, sigma));
        }
        if (mode === "sharpen") {
          return applyConvolution(baseImageData, buildSharpenKernel(rawValue / 100));
        }
        return applyEdgeDetection(baseImageData, rawValue / 100);
      }

      function previewBrightnessContrast(options = {}) {
        const b = Number(brightnessInput.value);
        const c = Number(contrastInput.value);
        return setToolPreview(
          "brightnessContrast",
          (baseImageData) => applyBrightnessContrast(baseImageData, b, c),
          {
            suppressStatus: options.suppressStatus,
            showError: options.showError,
            toastError: options.toastError,
            previewMessage: `亮度/對比預覽中（b=${b}, c=${c.toFixed(2)}），按「套用亮度 / 對比」確認。`,
            previewToast:
              !options.suppressStatus && options.ensureToast
                ? () => ({
                    type: "warn",
                    title: "亮度 / 對比預覽中",
                    message: `正在預覽 b=${b}、c=${c.toFixed(2)} 的結果。`
                  })
                : null
          }
        );
      }

      function previewBlend(options = {}) {
        if (!imageBData) {
          if (!options.suppressStatus) {
            setStatus("尚未上傳 B 圖，無法預覽混合。", "warn");
          }
          return false;
        }
        const alpha = Number(blendAlphaInput.value);
        return setToolPreview(
          "blend",
          (baseImageData) => blendTwoImages(baseImageData, imageBData, alpha),
          {
            suppressStatus: options.suppressStatus,
            showError: options.showError,
            showMissing: options.showMissing,
            toastError: options.toastError,
            toastWarn: options.toastWarn,
            previewMessage: `混合預覽中（α=${alpha.toFixed(2)}），按「套用混合」確認。`,
            previewToast:
              !options.suppressStatus && options.ensureToast
                ? () => ({
                    type: "warn",
                    title: "雙圖混合預覽中",
                    message: `正在預覽 α=${alpha.toFixed(2)} 的雙圖混合結果。`
                  })
                : null
          }
        );
      }

      function previewMosaic(options = {}) {
        const block = Number(blockSizeInput.value);
        return setToolPreview(
          "mosaic",
          (baseImageData) => applyPixelation(baseImageData, block),
          {
            suppressStatus: options.suppressStatus,
            showError: options.showError,
            toastError: options.toastError,
            previewMessage: `馬賽克預覽中（blockSize=${block}），按「套用馬賽克」確認。`,
            previewToast:
              !options.suppressStatus && options.ensureToast
                ? () => ({
                    type: "warn",
                    title: "馬賽克預覽中",
                    message: `正在預覽區塊大小 ${block} 的像素化效果。`
                  })
                : null
          }
        );
      }

      function previewWatermark(options = {}) {
        const text = watermarkTextInput.value.trim();
        const pos = watermarkPosInput.value;
        const alpha = Number(watermarkAlphaInput.value);
        if (!text) {
          if (activeTool === "watermark") {
            clearPreviewState();
            refreshCanvasView();
            refreshMatrixView();
            updateWorkspaceControls();
          }
          if (!options.suppressStatus) {
            setStatus("請先輸入水印文字。", "warn");
          }
          return false;
        }

        return setToolPreview(
          "watermark",
          (baseImageData) => applyWatermark(baseImageData, text, pos, alpha),
          {
            suppressStatus: options.suppressStatus,
            showError: options.showError,
            showMissing: options.showMissing,
            toastError: options.toastError,
            toastWarn: options.toastWarn,
            previewMessage: `水印預覽中（α=${alpha.toFixed(2)}），按「套用水印」確認。`,
            previewToast:
              !options.suppressStatus && options.ensureToast
                ? () => ({
                    type: "warn",
                    title: "水印預覽中",
                    message: `正在預覽「${text}」的水印位置與透明度。`
                  })
                : null
          }
        );
      }

      async function previewSpatialFilter(options = {}) {
        const requestId = ++spatialFilterPreviewRequestId;
        const mode = spatialFilterMode;
        const rawValue = Number(spatialFilterStrengthInput.value);
        const valueText = spatialFilterStrengthVal ? spatialFilterStrengthVal.textContent : String(rawValue);
        return await setToolPreviewAsync(
          "spatialFilter",
          async (baseImageData) => {
            if (options.isStale && options.isStale()) {
              return null;
            }
            const resultImageData = await buildSpatialFilterPreviewImage(baseImageData, mode, rawValue);
            if (!resultImageData) return null;
            return {
              imageData: resultImageData,
              resultImageData,
              mode,
              rawValue
            };
          },
          {
            suppressStatus: options.suppressStatus,
            showError: options.showError,
            toastError: options.toastError,
            ensureImageOptions: {
              toast: Boolean(options.ensureToast),
              message: "請先載入圖片 A。",
              toastMessage: "請先載入圖片 A。"
            },
            isStale() {
              return requestId !== spatialFilterPreviewRequestId;
            },
            previewMessage: `空間濾鏡預覽中（${getSpatialFilterModeLabel(mode)}，${valueText}），按「套用濾鏡」確認。`,
            previewToast:
              !options.suppressStatus && options.ensureToast
                ? () => ({
                    type: "warn",
                    title: "空間濾鏡預覽中",
                    message: `正在預覽 ${getSpatialFilterModeLabel(mode)}（${valueText}）。`
                  })
                : null,
            onPreviewReady(built) {
              spatialFilterPreviewInfo = built
                ? {
                    resultImageData: built.resultImageData,
                    mode: built.mode,
                    rawValue: built.rawValue
                  }
                : null;
            }
          }
        );
      }

      function normalizeSampleSize(value) {
        const n = Number.isFinite(value) ? Math.round(value) : 10;
        return Math.min(30, Math.max(3, n));
      }

      function resolveCanvasPointFromEvent(event, canvas, imageData) {
        if (!canvas || !imageData) {
          return null;
        }

        const renderBox = getCanvasRenderBox(imageData, canvas.width, canvas.height);
        if (!renderBox) {
          return null;
        }

        const rect = canvas.getBoundingClientRect();
        const canvasX = ((event.clientX - rect.left) * canvas.width) / rect.width;
        const canvasY = ((event.clientY - rect.top) * canvas.height) / rect.height;
        const insideX = canvasX >= renderBox.x && canvasX < renderBox.x + renderBox.width;
        const insideY = canvasY >= renderBox.y && canvasY < renderBox.y + renderBox.height;
        if (!insideX || !insideY) {
          return null;
        }

        const normalizedX = (canvasX - renderBox.x) / Math.max(1, renderBox.width);
        const normalizedY = (canvasY - renderBox.y) / Math.max(1, renderBox.height);
        return {
          x: Math.min(imageData.width - 1, Math.max(0, Math.floor(normalizedX * imageData.width))),
          y: Math.min(imageData.height - 1, Math.max(0, Math.floor(normalizedY * imageData.height)))
        };
      }

      // 給定 canvas 元素與 canvas-local 座標，回傳影像像素座標（供工具列使用）
      function resolveCanvasPoint(canvasEl, canvasX, canvasY) {
        if (!canvasEl || !ctx) return null;
        const img = getRenderableImageData();
        if (!img) return null;
        const renderBox = getCanvasRenderBox(img, canvasEl.width, canvasEl.height);
        if (!renderBox) return null;
        // 將 canvas-local 座標正規化（0 ~ width, 0 ~ height）
        const insideX = canvasX >= renderBox.x && canvasX < renderBox.x + renderBox.width;
        const insideY = canvasY >= renderBox.y && canvasY < renderBox.y + renderBox.height;
        if (!insideX || !insideY) return null;
        const normX = (canvasX - renderBox.x) / Math.max(1, renderBox.width);
        const normY = (canvasY - renderBox.y) / Math.max(1, renderBox.height);
        return {
          x: Math.min(img.width - 1, Math.max(0, Math.floor(normX * img.width))),
          y: Math.min(img.height - 1, Math.max(0, Math.floor(normY * img.height)))
        };
      }

      function updateCompareModalPoint(point) {
        if (!point) {
          return false;
        }
        selectedPoint = point;
        refreshMatrixView();
        return true;
      }

      function handleCanvasClick(event) {
        if (!ensureImageLoaded()) return;
        const renderable = getRenderableImageData();
        const point = resolveCanvasPointFromEvent(event, mainCanvas, renderable);
        if (!point) {
          return;
        }

        selectedPoint = {
          x: point.x,
          y: point.y
        };
        refreshMatrixView();
        setStatus(`已選取像素座標 (${selectedPoint.x}, ${selectedPoint.y})。`, "ok");
      }

      function handleCompareModalCanvasClick(event, sourceImageData) {
        if (!ensureImageLoaded()) return;
        const canvas = event.currentTarget;
        const point = resolveCanvasPointFromEvent(event, canvas, sourceImageData);
        if (!point) {
          return;
        }

        if (!updateCompareModalPoint(point)) {
          return;
        }
        setStatus(`前後對比取樣點已更新為 (${selectedPoint.x}, ${selectedPoint.y})。`, "ok");
      }

      function bindEvents() {
        fileInputA.addEventListener("change", async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await withProcessing("載入 A 圖中...", () => loadImageToCanvas(file, "A"));
          e.target.value = "";
        });

        fileInputB.addEventListener("change", async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await withProcessing("載入 B 圖中...", () => loadImageToCanvas(file, "B"));
          e.target.value = "";
        });

        dropZone.addEventListener("click", () => fileInputA.click());
        dropZone.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          fileInputA.click();
        });
        ["dragenter", "dragover"].forEach((evtName) => {
          dropZone.addEventListener(evtName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add("dragover");
          });
        });
        ["dragleave", "drop"].forEach((evtName) => {
          dropZone.addEventListener(evtName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove("dragover");
          });
        });
        dropZone.addEventListener("drop", async (e) => {
          const file = e.dataTransfer?.files?.[0];
          if (!file) return;
          await withProcessing("載入拖放圖片中...", () => loadImageToCanvas(file, "A"));
        });

        if (loadDemoSakuraBtn) {
          loadDemoSakuraBtn.addEventListener("click", async () => {
            const target = resolveDemoImageTarget();
            if (!target) {
              notifyStatus("已取消載入示範圖，保留目前工作內容。", "info");
              return;
            }
            await withProcessing(
              `載入示範圖片到 ${target} 圖中...`,
              () => loadImageFromPath(DEMO_FUJI_IMAGE_URL, DEMO_FUJI_IMAGE_NAME, target, { toast: true }),
              {
                title: "正在載入示範圖",
                message:
                  target === "B"
                    ? "請稍候，示範圖片會載入到 B 圖，避免覆蓋目前的 A 圖。"
                    : "請稍候，系統正在準備示範圖片。"
              }
            );
          });
        }

        if (moreToolsToggle) {
          moreToolsToggle.addEventListener("click", () => {
            toggleSecondaryTray();
          });
        }

        if (compareViewBtn) {
          compareViewBtn.addEventListener("click", () => {
            toggleCompareView();
          });
        }
        if (compareModalClose) {
          compareModalClose.addEventListener("click", () => {
            closeCompareModal();
          });
        }
        if (compareModalBackdrop) {
          compareModalBackdrop.addEventListener("click", () => {
            closeCompareModal();
          });
        }
        if (compareBeforeCanvas) {
          compareBeforeCanvas.addEventListener("click", (event) => {
            const compareState = getCompareViewState();
            handleCompareModalCanvasClick(event, compareState.beforeImageData);
          });
        }
        if (compareAfterCanvas) {
          compareAfterCanvas.addEventListener("click", (event) => {
            const compareState = getCompareViewState();
            handleCompareModalCanvasClick(event, compareState.afterImageData);
          });
        }
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && compareViewMode === "split") {
            closeCompareModal();
          }
        });

        restoreBtn.addEventListener("click", restoreOriginal);
        if (undoBtn) {
          undoBtn.addEventListener("click", undoHistory);
        }
        if (redoBtn) {
          redoBtn.addEventListener("click", redoHistory);
        }
        cancelPreviewBtn.addEventListener("click", cancelPreview);
        if (clearABtn) {
          clearABtn.addEventListener("click", clearImageAData);
        }
        clearBBtn.addEventListener("click", clearImageBData);
        exportBtn.addEventListener("click", exportPNG);
        if (toggleMatrixBtn) {
          toggleMatrixBtn.addEventListener("click", () => {
            setMatrixExpanded(!isMatrixExpanded);
          });
        }

        channelBtns.forEach((btn) => {
          btn.addEventListener("click", () => {
            renderChannelView(btn.dataset.mode || "rgb");
            setStatus(`通道顯示已切換為 ${modeLabel(displayMode)}。`, "ok");
          });
        });

        matrixChannelBtns.forEach((btn) => {
          btn.addEventListener("click", () => {
            matrixViewChannel = btn.dataset.matrixChannel || "r";
            updateMatrixChannelView();
          });
        });

        brightnessInput.addEventListener("input", () => {
          updateBCFormula();
          scheduleBCPreviewDebounced();
        });
        contrastInput.addEventListener("input", () => {
          updateBCFormula();
          scheduleBCPreviewDebounced();
        });

        // 防抖版本：UI 即時更新，影像渲染防抖 100ms
        const scheduleBCPreviewDebounced = debounce(() => {
          scheduleBCPreview({ ensureToast: true });
        }, PREVIEW_DEBOUNCE_MS);
        applyBCBtn.addEventListener("click", async () => {
          if (!ensureImageLoaded({ toast: true })) return;
          const b = Number(brightnessInput.value);
          const c = Number(contrastInput.value);
          lastAppliedMode = "BC_ADJUST";
          lastAppliedParams = { brightness: b, contrast: c };
          await withProcessing(
            "套用亮度與對比中...",
            () => {
              if (activeTool !== "brightnessContrast" || !hasPendingPreview()) {
                const built = previewBrightnessContrast({
                  suppressStatus: true,
                  showError: true,
                  toastError: {
                    title: "處理失敗"
                  }
                });
                if (!built) return;
              }
              commitPreviewToCurrent(`亮度/對比已套用（b=${b}, c=${c.toFixed(2)}）。`, {
                title: "操作成功",
                message: "亮度與對比已套用到影像。"
              }, {
                historyLabel: `亮度/對比 b=${b}, c=${c.toFixed(2)}`
              });
            },
            {
              title: "正在套用亮度與對比",
              message: "請稍候，系統正在更新目前影像。"
            }
          );
        });

        blendAlphaInput.addEventListener("input", () => {
          updateBlendFormula();
          scheduleBlendPreviewDebounced();
        });

        const scheduleBlendPreviewDebounced = debounce(() => {
          scheduleBlendPreview({ ensureToast: true });
        }, PREVIEW_DEBOUNCE_MS);
        applyBlendBtn.addEventListener("click", async () => {
          if (!ensureImageLoaded({ toast: true })) return;
          if (!imageBData) {
            notifyStatus("尚未上傳 B 圖，無法預覽混合。", "warn", {
              title: "尚未載入 B 圖",
              message: "無法進行混合，請先上傳圖片（B）。"
            });
            return;
          }
          const alpha = Number(blendAlphaInput.value);
          lastAppliedMode = "BLEND";
          lastAppliedParams = { alpha };
          await withProcessing(
            "混合兩張影像中...",
            () => {
              if (activeTool !== "blend" || !hasPendingPreview()) {
                const built = previewBlend({
                  suppressStatus: true,
                  showError: true,
                  toastError: {
                    title: "混合失敗"
                  }
                });
                if (!built) return;
              }
              commitPreviewToCurrent(`雙圖混合完成（α=${alpha.toFixed(2)}）。`, {
                title: "混合完成",
                message: "已完成 A 與 B 的影像混合。"
              }, {
                historyLabel: `雙圖混合 α=${alpha.toFixed(2)}`
              });
            },
            {
              title: "正在混合影像",
              message: "請稍候，系統正在把 A 與 B 進行混合。"
            }
          );
        });

        blockSizeInput.addEventListener("input", () => {
          updateMosaicLabel();
          scheduleMosaicPreviewDebounced();
        });

        const scheduleMosaicPreviewDebounced = debounce(() => {
          scheduleMosaicPreview({ ensureToast: true });
        }, PREVIEW_DEBOUNCE_MS);
        applyMosaicBtn.addEventListener("click", async () => {
          if (!ensureImageLoaded({ toast: true })) return;
          const block = Number(blockSizeInput.value);
          lastAppliedMode = "MOSAIC";
          lastAppliedParams = { blockSize: block };
          await withProcessing(
            "套用馬賽克中...",
            () => {
              if (activeTool !== "mosaic" || !hasPendingPreview()) {
                const built = previewMosaic({
                  suppressStatus: true,
                  showError: true,
                  toastError: {
                    title: "處理失敗"
                  }
                });
                if (!built) return;
              }
              commitPreviewToCurrent(`馬賽克完成（blockSize=${block}）。`, {
                title: "操作成功",
                message: "馬賽克效果已套用到影像。"
              }, {
                historyLabel: `馬賽克 block=${block}`
              });
            },
            {
              title: "正在套用馬賽克",
              message: "請稍候，系統正在產生馬賽克效果。"
            }
          );
        });

        watermarkAlphaInput.addEventListener("input", () => {
          updateWatermarkLabel();
          scheduleWatermarkPreviewDebounced();
        });
        watermarkTextInput.addEventListener("input", () => {
          scheduleWatermarkPreviewDebounced();
        });

        const scheduleWatermarkPreviewDebounced = debounce(() => {
          scheduleWatermarkPreview({ ensureToast: true });
        }, PREVIEW_DEBOUNCE_MS);
        watermarkPosInput.addEventListener("change", () => {
          syncWatermarkPosButtons();
          scheduleWatermarkPreviewDebounced();
        });
        watermarkPosButtons.forEach((btn) => {
          btn.addEventListener("click", () => {
            const nextPos = btn.dataset.watermarkPos;
            if (!nextPos || watermarkPosInput.value === nextPos) return;
            watermarkPosInput.value = nextPos;
            syncWatermarkPosButtons();
            scheduleWatermarkPreviewDebounced();
          });
        });
        applyWatermarkBtn.addEventListener("click", async () => {
          if (!ensureImageLoaded({ toast: true })) return;
          if (!watermarkTextInput.value.trim()) {
            notifyStatus("請先輸入水印文字。", "warn", {
              title: "缺少水印文字",
              message: "請先輸入要套用的水印內容。"
            });
            return;
          }
          const alpha = Number(watermarkAlphaInput.value);
          await withProcessing(
            "套用水印中...",
            () => {
              if (activeTool !== "watermark" || !hasPendingPreview()) {
                const built = previewWatermark({
                  suppressStatus: true,
                  showError: true,
                  toastError: {
                    title: "處理失敗"
                  }
                });
                if (!built) return;
              }
              commitPreviewToCurrent(
                `水印已套用（位置：${watermarkPosInput.options[watermarkPosInput.selectedIndex].text}，α=${alpha.toFixed(2)}）。`,
                {
                  title: "操作成功",
                  message: "水印已套用到目前影像。"
                },
                {
                  historyLabel: `水印 α=${alpha.toFixed(2)}`
                }
              );
            },
            {
              title: "正在套用水印",
              message: "請稍候，系統正在把水印寫到影像上。"
            }
          );
        });

        fftModeButtons.forEach((btn) => {
          btn.addEventListener("click", () => {
            const nextMode = btn.dataset.fftMode;
            if (!nextMode || fftMode === nextMode) return;
            fftMode = nextMode;
            updateFFTModeButtons();
            scheduleFFTPreviewDebounced();
          });
        });
        if (fftStrengthInput) {
          fftStrengthInput.addEventListener("input", () => {
            updateFFTStrengthLabel();
            scheduleFFTPreviewDebounced();
          });
        }
        const scheduleFFTPreviewDebounced = debounce(() => {
          scheduleFFTPreview({ ensureToast: true });
        }, PREVIEW_DEBOUNCE_MS);
        if (applyFFTBtn) {
          applyFFTBtn.addEventListener("click", async () => {
            if (
              !ensureImageLoaded({
                toast: true,
                message: "請先載入圖片 A。",
                toastMessage: "請先載入圖片 A。"
              })
            ) {
              return;
            }
            const strength = Number(fftStrengthInput.value);
            lastAppliedMode = "FFT";
            lastAppliedParams = { fftMode, fftStrength: strength };
            await withProcessing(
              "進行 FFT 分析中...",
              async () => {
                if (activeTool !== "fft" || !hasPendingPreview()) {
                  const built = await previewFFT({
                    suppressStatus: true,
                    showError: true,
                    ensureToast: true,
                    toastError: {
                      title: "FFT 預覽失敗"
                    }
                  });
                  if (!built) return;
                }
                commitPreviewToCurrent(
                  `FFT 已套用（${getFFTModeLabel(fftMode)}，強度 ${strength}）。`,
                  {
                    title: "FFT 套用完成",
                    message: `已完成 ${getFFTModeLabel(fftMode)}處理。`
                  },
                  {
                    historyLabel: `FFT ${getFFTModeLabel(fftMode)} 強度 ${strength}`,
                    preserveAnalysisPreview: true
                  }
                );
              },
              {
                title: "正在計算 FFT",
                message: "請稍候，系統正在進行頻域分析與濾波。"
              }
            );
          });
        }

        if (pcaRetentionInput) {
          pcaRetentionInput.addEventListener("input", () => {
            updatePCARetentionLabel();
            schedulePCAPreviewDebounced();
          });
        }
        const schedulePCAPreviewDebounced = debounce(() => {
          schedulePCAPreview({ ensureToast: true });
        }, PREVIEW_DEBOUNCE_MS);
        if (applyPCABtn) {
          applyPCABtn.addEventListener("click", async () => {
            if (
              !ensureImageLoaded({
                toast: true,
                message: "請先載入圖片 A。",
                toastMessage: "請先載入圖片 A。"
              })
            ) {
              return;
            }
            const retention = Number(pcaRetentionInput.value);
            lastAppliedMode = "PCA";
            lastAppliedParams = { pcaRetention: retention };
            await withProcessing(
              "執行 PCA 壓縮中...",
              async () => {
                if (activeTool !== "pca" || !hasPendingPreview()) {
                  const built = await previewPCA({
                    suppressStatus: true,
                    showError: true,
                    ensureToast: true,
                    toastError: {
                      title: "PCA 預覽失敗"
                    }
                  });
                  if (!built) return;
                }
                const infoText = pcaPreviewInfo
                  ? `壓縮比 ${formatRatio(pcaPreviewInfo.compressionRatio)}，資訊保留率 ${formatPercent(pcaPreviewInfo.infoRetention)}`
                  : "已完成 PCA 重建。";
                commitPreviewToCurrent(
                  `PCA 已套用（保留 ${retention}% 主成分）。`,
                  {
                    title: "PCA 套用完成",
                    message: infoText
                  },
                  {
                    historyLabel: `PCA 保留 ${retention}%`,
                    preserveAnalysisPreview: true
                  }
                );
              },
              {
                title: "正在執行 PCA",
                message: "請稍候，系統正在進行降維與影像重建。"
              }
            );
          });
        }

        filterModeButtons.forEach((btn) => {
          btn.addEventListener("click", () => {
            const nextMode = btn.dataset.filterMode;
            if (!nextMode || nextMode === spatialFilterMode) return;
            spatialFilterMode = nextMode;
            updateSpatialFilterUI();
            scheduleSpatialFilterPreview({ ensureToast: true });
          });
        });
        if (spatialFilterStrengthInput) {
          spatialFilterStrengthInput.addEventListener("input", () => {
            updateSpatialFilterUI();
            scheduleSpatialFilterPreviewDebounced();
          });
        }
        const scheduleSpatialFilterPreviewDebounced = debounce(() => {
          scheduleSpatialFilterPreview({ ensureToast: true });
        }, PREVIEW_DEBOUNCE_MS);
        if (applySpatialFilterBtn) {
          applySpatialFilterBtn.addEventListener("click", async () => {
            if (!ensureImageLoaded({ toast: true })) return;
            const mode = spatialFilterMode;
            const valueText = spatialFilterStrengthVal ? spatialFilterStrengthVal.textContent : spatialFilterStrengthInput.value;
            const kernelSize = Number(spatialFilterStrengthInput.value);
            lastAppliedMode = "SPATIAL";
            lastAppliedParams = { filterMode: mode, kernelSize };
            await withProcessing(
              "套用空間域濾鏡中...",
              () => {
                if (activeTool !== "spatialFilter" || !hasPendingPreview()) {
                  const built = previewSpatialFilter({
                    suppressStatus: true,
                    showError: true,
                    toastError: {
                      title: "濾鏡預覽失敗"
                    }
                  });
                  if (!built) return;
                }
                commitPreviewToCurrent(
                  `空間域濾鏡已套用（${getSpatialFilterModeLabel(mode)}，${valueText}）。`,
                  {
                    title: "濾鏡套用完成",
                    message: `已完成 ${getSpatialFilterModeLabel(mode)}處理。`
                  },
                  {
                    historyLabel: `空間濾鏡 ${getSpatialFilterModeLabel(mode)} ${valueText}`
                  }
                );
              },
              {
                title: "正在套用空間域濾鏡",
                message: "請稍候，系統正在執行卷積運算。"
              }
            );
          });
        }

        const scheduleCannyPreviewDebounced = debounce(() => {
          scheduleCannyPreview({ ensureToast: true });
        }, PREVIEW_DEBOUNCE_MS);

        if (cannyBlurInput) {
          cannyBlurInput.addEventListener("input", () => {
            if (activeCannyWorker) {
              activeCannyWorker.terminate();
              activeCannyWorker = null;
            }
            updateCannyControlLabels();
            scheduleCannyPreviewDebounced();
          });
        }
        if (cannyLowThresholdInput) {
          cannyLowThresholdInput.addEventListener("input", () => {
            if (activeCannyWorker) {
              activeCannyWorker.terminate();
              activeCannyWorker = null;
            }
            updateCannyControlLabels("low");
            scheduleCannyPreviewDebounced();
          });
        }
        if (cannyHighThresholdInput) {
          cannyHighThresholdInput.addEventListener("input", () => {
            if (activeCannyWorker) {
              activeCannyWorker.terminate();
              activeCannyWorker = null;
            }
            updateCannyControlLabels("high");
            scheduleCannyPreviewDebounced();
          });
        }

        // 初始化氣泡功能
        bindCannySliderBubble(cannyBlurInput, cannyBlurBubble);
        bindCannySliderBubble(cannyLowThresholdInput, cannyLowThresholdBubble);
        bindCannySliderBubble(cannyHighThresholdInput, cannyHighThresholdBubble);
        if (applyCannyBtn) {
          applyCannyBtn.addEventListener("click", async () => {
            if (
              !ensureImageLoaded({
                toast: true,
                message: "請先載入圖片 A。",
                toastMessage: "請先載入圖片 A。"
              })
            ) {
              return;
            }
            const settings = getCannyControlSettings();
            lastAppliedMode = "CANNY";
            lastAppliedParams = {
              cannyBlur: settings.blurStrength,
              cannyLow: settings.lowThreshold,
              cannyHigh: settings.highThreshold,
            };
            await withProcessing(
              "執行 Canny 邊緣偵測中...",
              async () => {
                if (activeTool !== "canny" || !hasPendingPreview()) {
                  const built = await previewCanny({
                    suppressStatus: true,
                    showError: true,
                    ensureToast: true,
                    toastError: {
                      title: "Canny 預覽失敗"
                    }
                  });
                  if (!built) return;
                }
                const appliedInfo = cannyPreviewInfo || settings;
                const densityText =
                  cannyPreviewInfo && Number.isFinite(cannyPreviewInfo.edgeDensity)
                    ? formatPercent(cannyPreviewInfo.edgeDensity)
                    : "未知";
                commitPreviewToCurrent(
                  `Canny 邊緣偵測已套用（blur ${appliedInfo.blurStrength}，low ${appliedInfo.lowThreshold}，high ${appliedInfo.highThreshold}）。`,
                  {
                    title: "Canny 套用完成",
                    message:
                      cannyPreviewInfo && Number.isFinite(cannyPreviewInfo.edgePixelCount)
                        ? `已輸出穩定邊緣圖，保留 ${cannyPreviewInfo.edgePixelCount.toLocaleString()} 個邊緣像素，邊緣密度 ${densityText}。`
                        : "已輸出穩定邊緣圖。"
                  },
                  {
                    historyLabel: `Canny blur ${appliedInfo.blurStrength} low ${appliedInfo.lowThreshold} high ${appliedInfo.highThreshold}`,
                    preserveAnalysisPreview: true
                  }
                );
              },
              {
                title: "正在執行 Canny",
                message: "請稍候，系統正在進行降噪、梯度、非極大值抑制與滯後邊緣連接。"
              }
            );
          });
        }

        const handleSampleResize = () => {
          sampleSizeN = normalizeSampleSize(Number(sampleSizeInput.value));
          sampleSizeInput.value = String(sampleSizeN);
          updateSampleSizeLabel();
          refreshMatrixView();
        };
        sampleSizeInput.addEventListener("input", handleSampleResize);
        sampleSizeInput.addEventListener("change", () => {
          handleSampleResize();
          setStatus(`矩陣取樣大小更新為 ${sampleSizeN} × ${sampleSizeN}。`, "ok");
        });

        // ── 工具列按鈕 ────────────────────────────────────────────────
        function selectTool(toolName) {
          currentTool = toolName;
          document.querySelectorAll(".rail-btn[data-tool]").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.tool === toolName);
          });
          if (toolName === "zoom") {
            mainCanvas.style.cursor = "zoom-in";
          } else {
            mainCanvas.style.cursor = toolName === "probe" ? "crosshair" : "grab";
          }
        }

        function applyTransform() {
          const t = `translate(${dragOffsetX}px, ${dragOffsetY}px) scale(${canvasScale})`;
          if (mainCanvas) mainCanvas.style.transform = t;
          if (mainCanvasOverlay) mainCanvasOverlay.style.transform = t;
        }

        function applyZoomFit() {
          if (!mainCanvas || !canvasWrap) return;
          const img = getRenderableImageData();
          if (!img) return;
          const cw = canvasWrap.clientWidth - 28;
          const ch = canvasWrap.clientHeight - 28;
          const scaleX = cw / img.width;
          const scaleY = ch / img.height;
          canvasScale = Math.min(scaleX, scaleY, 1);
          dragOffsetX = (cw - img.width * canvasScale) / 2;
          dragOffsetY = (ch - img.height * canvasScale) / 2;
          mainCanvas.style.width = `${img.width * canvasScale}px`;
          mainCanvas.style.height = `${img.height * canvasScale}px`;
          applyTransform();
          if (mainCanvasOverlay) {
            mainCanvasOverlay.style.width = `${img.width * canvasScale}px`;
            mainCanvasOverlay.style.height = `${img.height * canvasScale}px`;
          }
          updateWorkspaceDisplay();
        }

        function applyZoomReset() {
          canvasScale = 1;
          dragOffsetX = 0;
          dragOffsetY = 0;
          mainCanvas.style.width = "";
          mainCanvas.style.height = "";
          applyTransform();
          if (mainCanvasOverlay) {
            mainCanvasOverlay.style.width = "";
            mainCanvasOverlay.style.height = "";
          }
          updateWorkspaceDisplay();
        }

        ["Pan", "Probe", "Zoom"].forEach((tool) => {
          const btn = document.getElementById(`toolBtn${tool}`);
          if (!btn) return;
          btn.addEventListener("click", () => {
            if (tool === "Zoom") {
              canvasScale < 0.99 ? applyZoomReset() : applyZoomFit();
            }
            selectTool(tool.toLowerCase());
          });
        });

        // ── Canvas Pointer 統一事件 ───────────────────────────────────
        function getPointerPos(e) {
          const rect = mainCanvas.getBoundingClientRect();
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          return {
            x: clientX - rect.left,
            y: clientY - rect.top
          };
        }

        function syncOverlaySize() {
          if (!mainCanvasOverlay || !mainCanvas) return;
          mainCanvasOverlay.width = mainCanvas.width;
          mainCanvasOverlay.height = mainCanvas.height;
        }
        syncOverlaySize();

        mainCanvas.addEventListener("pointerdown", (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          const pos = getPointerPos(e);

          if (currentTool === "pan") {
            isDragging = true;
            dragStartX = e.offsetX - dragOffsetX;
            dragStartY = e.offsetY - dragOffsetY;
            mainCanvas.style.cursor = "grabbing";
            updateWorkspaceDisplay();
          } else if (currentTool === "probe") {
            selectedPoint = resolveCanvasPoint(mainCanvas, pos.x, pos.y);
            refreshMatrixView();
          }
        });

        mainCanvas.addEventListener("click", (e) => {
          if (currentTool === "probe") return;
          handleCanvasClick(e);
        });

        mainCanvas.addEventListener("pointermove", (e) => {
          const pos = getPointerPos(e);

          // Probe 模式：滑鼠經過即時更新右側矩陣面板
          if (currentTool === "probe" && !e.buttons && !e.touches) {
            const pt = resolveCanvasPoint(mainCanvas, pos.x, pos.y);
            if (pt) {
              selectedPoint = pt;
              refreshMatrixView();
            }
            return;
          }

          if (currentTool === "pan" && isDragging) {
            dragOffsetX = e.offsetX - dragStartX;
            dragOffsetY = e.offsetY - dragStartY;
            applyTransform();
            updateWorkspaceDisplay();
          }
        });

        mainCanvas.addEventListener("pointerup", () => {
          if (isDragging) {
            isDragging = false;
            mainCanvas.style.cursor = "grab";
            updateWorkspaceDisplay();
          }
        });

        mainCanvas.addEventListener("pointerleave", () => {
          if (isDragging) {
            isDragging = false;
            mainCanvas.style.cursor = "grab";
          }
        });

        // 滾輪縮放（桌面）
        mainCanvas.addEventListener("wheel", (e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          const newScale = Math.min(Math.max(canvasScale * delta, 0.1), 10);
          const pos = getPointerPos(e);
          dragOffsetX = pos.x - (pos.x - dragOffsetX) * (newScale / canvasScale);
          dragOffsetY = pos.y - (pos.y - dragOffsetY) * (newScale / canvasScale);
          canvasScale = newScale;
          applyTransform();
          updateWorkspaceDisplay();
        }, { passive: false });

        // 觸控雙指縮放
        mainCanvas.addEventListener("touchmove", (e) => {
          if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (lastTouchDist > 0) {
              canvasScale = Math.min(Math.max(canvasScale * (dist / lastTouchDist), 0.1), 10);
              applyTransform();
              updateWorkspaceDisplay();
            }
            lastTouchDist = dist;
          }
        }, { passive: false });
        mainCanvas.addEventListener("touchend", () => { lastTouchDist = 0; });

        // ── Canny 長按對比（整合版：僅在 pan 工具下生效）────────────────
        let cannyLongPressTimer = null;
        let cannyLongPressActive = false;
        let cannySavedImageData = null;

        function startCannyLongPress() {
          if (!cannyLongPressOverlay) return;
          if (activeTool !== "canny" || !hasPendingPreview()) return;
          if (!originalImageData) return;
          if (currentTool !== "pan") return; // 僅 pan 模式可用

          cannySavedImageData = getRenderableImageData();
          cannyLongPressActive = true;
          ctx.putImageData(originalImageData, 0, 0);
          cannyLongPressOverlay.classList.add("is-active");
          if (canvasWrap) canvasWrap.classList.add("is-canny-holding");
        }

        function endCannyLongPress() {
          if (!cannyLongPressActive) return;
          cannyLongPressActive = false;
          if (cannyLongPressOverlay) cannyLongPressOverlay.classList.remove("is-active");
          if (canvasWrap) canvasWrap.classList.remove("is-canny-holding");
          if (cannySavedImageData) {
            ctx.putImageData(cannySavedImageData, 0, 0);
            cannySavedImageData = null;
          }
        }

        if (mainCanvas && cannyLongPressOverlay) {
          // 觸控：touchstart / touchend
          mainCanvas.addEventListener("touchstart", (e) => {
            cannyLongPressTimer = window.setTimeout(() => {
              if (currentTool === "pan") startCannyLongPress();
            }, 350);
          }, { passive: false });
          mainCanvas.addEventListener("touchend", () => {
            clearTimeout(cannyLongPressTimer);
            endCannyLongPress();
          });
          mainCanvas.addEventListener("touchcancel", () => {
            clearTimeout(cannyLongPressTimer);
            endCannyLongPress();
          });

          // 滑鼠：mousedown / mouseup / mouseleave
          mainCanvas.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            cannyLongPressTimer = window.setTimeout(() => {
              if (currentTool === "pan") startCannyLongPress();
            }, 350);
          });
          mainCanvas.addEventListener("mouseup", () => {
            clearTimeout(cannyLongPressTimer);
            endCannyLongPress();
          });
          mainCanvas.addEventListener("mouseleave", () => {
            clearTimeout(cannyLongPressTimer);
            endCannyLongPress();
          });
        }

        // LSB：輸入框內容變化時即時更新寫入按鈕可用性
        if (stegoMessageInput) {
          stegoMessageInput.addEventListener("input", () => {
            updateWorkspaceControls();
          });
        }

        embedBtn.addEventListener("click", async () => {
          if (!ensureImageLoaded({ toast: true })) return;
          if (!requireCommittedState("執行隱寫", { toast: true })) return;
          const message = stegoMessageInput.value;
          try {
            await withProcessing(
              "寫入 LSB 訊息中...",
              () => {
                const compareBase = currentImageData ? cloneImageData(currentImageData) : null;
                currentImageData = embedMessageLSB(currentImageData, message);
                clearPreviewState();
                captureCompareBaseImage(compareBase);
                pushHistoryState("LSB 寫入", currentImageData);
                refreshCanvasView();
                refreshMatrixView();
                updateWorkspaceControls();
              },
              {
                title: "正在寫入 LSB",
                message: "請稍候，訊息會寫入目前影像。"
              }
            );
            notifyStatus("訊息已寫入影像 LSB，請用 PNG 匯出保存。", "ok", {
              title: "寫入完成",
              message: "訊息已寫入影像 LSB，請用 PNG 匯出保存。"
            });
          } catch (err) {
            const errorMessage = err.message || "寫入訊息失敗。";
            const type =
              errorMessage === "請先輸入要藏入的訊息。" || errorMessage.startsWith("訊息過長：")
                ? "warn"
                : "error";
            notifyStatus(errorMessage, type, {
              title: type === "warn" ? "無法寫入 LSB" : "寫入失敗",
              message: errorMessage
            });
          }
        });

        extractBtn.addEventListener("click", async () => {
          if (!ensureImageLoaded({ toast: true })) return;
          if (!requireCommittedState("讀取訊息", { toast: true })) return;
          try {
            let decodedMessage = "";
            await withProcessing(
              "讀取 LSB 訊息中...",
              () => {
                decodedMessage = extractMessageLSB(currentImageData);
                stegoOutput.textContent = decodedMessage || "（讀到長度為 0，沒有訊息）";
              },
              {
                title: "正在讀取 LSB",
                message: "請稍候，系統正在分析目前影像。"
              }
            );
            notifyStatus("LSB 訊息讀取完成。", "ok", {
              title: "讀取完成",
              message: decodedMessage ? "已從圖片讀出隱寫訊息。" : "讀取完成，但目前沒有讀到文字內容。"
            });
            updateWorkspaceControls();
          } catch (err) {
            stegoOutput.textContent = "（讀取失敗）";
            notifyStatus(err.message || "讀取訊息失敗。", "error", {
              title: "讀取失敗",
              message: err.message || "讀取訊息失敗。"
            });
          }
        });

      }

      function initialize() {
        // ── 手機效能降級偵測 ──────────────────────────────────────────
        const ua = (navigator.userAgent || "").toLowerCase();
        const hasTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
        isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
          || window.innerWidth < 768
          || hasTouch;
        if (isMobile) {
          document.body.classList.add("is-mobile");
        }

        hydrateAdvancedToolCopy();
        updateCapacityHint();
        updateBCFormula();
        updateBlendFormula();
        updateMosaicLabel();
        updateWatermarkLabel();
        updateFFTModeButtons();
        updateFFTStrengthLabel();
        updatePCARetentionLabel();
        updateSpatialFilterUI();
        updatePCAMetrics(null);
        updateCannyControlLabels();
        updateCannyMetrics(null);
        updateSampleSizeLabel();
        setMatrixExpanded(true);
        updateModeStatus();
        updateMatrixChannelView();
        syncWatermarkPosButtons();
        toggleSecondaryTray(false);
        bindEvents();
        generateDefaultTestImage();
        updateAllPreviews();
        updateWorkspaceControls();
        setStatus("系統就緒：已載入預設測試圖，可直接展示。", "ok");
        
        if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
          window.MathJax.startup.promise.then(function() {
            renderMathJax();
          }).catch(function(err) {
            console.log('MathJax startup promise error:', err);
            renderMathJax();
          });
        } else {
          window.addEventListener("load", function() {
            setTimeout(renderMathJax, 500);
          });
        }
      }

      initialize();
    })();
