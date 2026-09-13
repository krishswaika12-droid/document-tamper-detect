function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function drawToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx };
}

function getResavedImageData(sourceCanvas, quality) {
  const resavedUrl = sourceCanvas.toDataURL('image/jpeg', quality / 100);
  return new Promise((resolve) => {
    const resavedImg = new Image();
    resavedImg.onload = () => {
      const { ctx } = drawToCanvas(resavedImg);
      resolve(ctx.getImageData(0, 0, resavedImg.width, resavedImg.height));
    };
    resavedImg.src = resavedUrl;
  });
}

// Divide the image into a grid and compute an average "suspicion score" per block.
// This turns millions of noisy pixel values into a small number of readable regions.
function computeBlockScores(diffArray, width, height, blockSize = 16) {
  const cols = Math.ceil(width / blockSize);
  const rows = Math.ceil(height / blockSize);
  const blockScores = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const brightness = (diffArray[i] + diffArray[i + 1] + diffArray[i + 2]) / 3;
      const blockX = Math.floor(x / blockSize);
      const blockY = Math.floor(y / blockSize);
      blockScores[blockY][blockX] += brightness;
    }
  }

  // Convert sums into averages per block
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const pixelsInBlock = blockSize * blockSize;
      blockScores[by][bx] = blockScores[by][bx] / pixelsInBlock;
    }
  }

  return { blockScores, cols, rows };
}

export async function computeELA(file, options = {}) {
  const { qualities = [70, 90], blockSize = 16 } = options;

  const img = await loadImage(file);
  const { canvas, ctx } = drawToCanvas(img);
  const original = ctx.getImageData(0, 0, img.width, img.height);

  // Run ELA at multiple quality levels and average the results —
  // this catches edits that only show up clearly at certain compression levels
  const diffAccumulator = new Float32Array(original.data.length);

  for (const quality of qualities) {
    const resaved = await getResavedImageData(canvas, quality);
    for (let i = 0; i < original.data.length; i += 4) {
      diffAccumulator[i] += Math.abs(original.data[i] - resaved.data[i]);
      diffAccumulator[i + 1] += Math.abs(original.data[i + 1] - resaved.data[i + 1]);
      diffAccumulator[i + 2] += Math.abs(original.data[i + 2] - resaved.data[i + 2]);
    }
  }

  // Average across the number of quality passes
  for (let i = 0; i < diffAccumulator.length; i++) {
    diffAccumulator[i] = diffAccumulator[i] / qualities.length;
  }

  let maxDiff = 0;
  for (let i = 0; i < diffAccumulator.length; i += 4) {
    maxDiff = Math.max(maxDiff, diffAccumulator[i], diffAccumulator[i + 1], diffAccumulator[i + 2]);
  }

  // Build the visible heatmap (amplified)
  const diffImageData = ctx.createImageData(img.width, img.height);
  const scale = maxDiff > 0 ? 255 / maxDiff : 1;
  for (let i = 0; i < diffAccumulator.length; i += 4) {
    diffImageData.data[i] = Math.min(255, diffAccumulator[i] * scale);
    diffImageData.data[i + 1] = Math.min(255, diffAccumulator[i + 1] * scale);
    diffImageData.data[i + 2] = Math.min(255, diffAccumulator[i + 2] * scale);
    diffImageData.data[i + 3] = 255;
  }
  ctx.putImageData(diffImageData, 0, 0);

  // Block-level analysis: find the most suspicious regions specifically
  const { blockScores, cols, rows } = computeBlockScores(
    diffAccumulator,
    img.width,
    img.height,
    blockSize
  );

  // Compute average + standard deviation across all blocks —
  // a block is "suspicious" if it's a statistical outlier compared to the rest of the image,
  // not just based on a fixed number (this adapts per-image, avoiding false positives on busy images)
  const allScores = blockScores.flat();
  const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const variance = allScores.reduce((a, b) => a + (b - mean) ** 2, 0) / allScores.length;
  const stdDev = Math.sqrt(variance);

  const suspiciousBlocks = [];
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const score = blockScores[by][bx];
      const zScore = stdDev > 0 ? (score - mean) / stdDev : 0;
      if (zScore > 2) {
        // more than 2 standard deviations above average = statistically unusual
        suspiciousBlocks.push({
          x: bx * blockSize,
          y: by * blockSize,
          width: blockSize,
          height: blockSize,
          zScore: Number(zScore.toFixed(2)),
        });
      }
    }
  }

  return {
    elaUrl: canvas.toDataURL('image/png'),
    maxDiff,
    meanDiff: mean,
    stdDevDiff: stdDev,
    suspiciousBlocks, // array of {x, y, width, height, zScore}
    suspiciousBlockCount: suspiciousBlocks.length,
  };
}