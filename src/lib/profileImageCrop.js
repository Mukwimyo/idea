const MAX_GIF_SOURCE_PIXELS = 16_000_000
const MAX_GIF_CROPPED_FRAME_PIXELS = 16_000_000
const MAX_GIF_FRAME_COUNT = 600
const MAX_GIF_DECODED_PATCH_PIXELS = 16_000_000
const MAX_PALETTE_SAMPLE_FRAMES = 24
const MAX_PALETTE_SAMPLE_PIXELS = 8192

const yieldToBrowser = () => new Promise(resolve => window.setTimeout(resolve, 0))

function makeCrop(pixelCrop, imageWidth, imageHeight) {
  const left = Math.max(0, Math.min(imageWidth - 1, Math.floor(pixelCrop.x)))
  const top = Math.max(0, Math.min(imageHeight - 1, Math.floor(pixelCrop.y)))
  const right = Math.max(left + 1, Math.min(imageWidth, Math.ceil(pixelCrop.x + pixelCrop.width)))
  const bottom = Math.max(top + 1, Math.min(imageHeight, Math.ceil(pixelCrop.y + pixelCrop.height)))
  return { left, top, width: right - left, height: bottom - top }
}

function loadImage(imageSrc) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 불러오지 못했어요.'))
    image.src = imageSrc
  })
}

async function cropStillImage(imageSrc, pixelCrop) {
  const image = await loadImage(imageSrc)
  const width = Math.max(1, Math.round(pixelCrop.width))
  const height = Math.max(1, Math.round(pixelCrop.height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('이미지를 자르지 못했어요.')
  context.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, width, height)
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('이미지를 자르지 못했어요.')), 'image/jpeg', 0.92)
  })
  return new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
}

async function renderCroppedFrames(frames, sourceWidth, sourceHeight, crop, onFrame, onProgress) {
  const canvas = document.createElement('canvas')
  canvas.width = sourceWidth
  canvas.height = sourceHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const patchCanvas = document.createElement('canvas')
  const patchContext = patchCanvas.getContext('2d', { willReadFrequently: true })
  if (!context || !patchContext) throw new Error('GIF를 처리할 수 없어요.')

  let previousFrame = null
  let previousSnapshot = null

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]

    if (previousFrame?.disposalType === 2) {
      const { left, top, width, height } = previousFrame.dims
      if (previousFrame.transparentIndex !== undefined) {
        context.clearRect(left, top, width, height)
      } else {
        const background = frame.backgroundColor
        if (background) {
          context.fillStyle = `rgb(${background[0]} ${background[1]} ${background[2]})`
          context.fillRect(left, top, width, height)
        } else {
          context.clearRect(left, top, width, height)
        }
      }
    } else if (previousFrame?.disposalType === 3 && previousSnapshot) {
      context.putImageData(previousSnapshot, 0, 0)
    }

    const snapshot = frame.disposalType === 3 ? context.getImageData(0, 0, sourceWidth, sourceHeight) : null
    const { width, height, left, top } = frame.dims
    patchCanvas.width = width
    patchCanvas.height = height
    const currentPatchContext = patchCanvas.getContext('2d')
    if (!currentPatchContext) throw new Error('GIF를 처리할 수 없어요.')
    const patch = currentPatchContext.createImageData(width, height)
    patch.data.set(frame.patch)
    currentPatchContext.putImageData(patch, 0, 0)
    context.drawImage(patchCanvas, left, top)

    const croppedFrame = context.getImageData(crop.left, crop.top, crop.width, crop.height)
    await onFrame(croppedFrame, frame, index)
    previousFrame = frame
    previousSnapshot = snapshot
    onProgress?.(index + 1, frames.length)

    if (index % 6 === 5) await yieldToBrowser()
  }
}

function samplePixels(imageData) {
  const totalPixels = imageData.data.length / 4
  const stride = Math.max(1, Math.ceil(totalPixels / MAX_PALETTE_SAMPLE_PIXELS))
  const samples = new Uint8ClampedArray(Math.ceil(totalPixels / stride) * 4)
  let sampleOffset = 0
  for (let pixel = 0; pixel < totalPixels; pixel += stride) {
    const offset = pixel * 4
    samples[sampleOffset] = imageData.data[offset]
    samples[sampleOffset + 1] = imageData.data[offset + 1]
    samples[sampleOffset + 2] = imageData.data[offset + 2]
    samples[sampleOffset + 3] = imageData.data[offset + 3]
    sampleOffset += 4
  }
  return samples.subarray(0, sampleOffset)
}

function paletteFor(samples, hasTransparency, quantize) {
  const format = hasTransparency ? 'rgba4444' : 'rgb565'
  let paletteSamples = samples
  if (hasTransparency) {
    paletteSamples = new Uint8ClampedArray(samples.length + 4)
    paletteSamples.set(samples)
  }
  const palette = quantize(paletteSamples, 256, hasTransparency ? { format, oneBitAlpha: true } : { format })

  if (hasTransparency) {
    let transparentIndex = palette.findIndex(color => color[3] === 0)
    if (transparentIndex < 0) {
      if (palette.length >= 256) palette.pop()
      palette.unshift([0, 0, 0, 0])
      transparentIndex = 0
    } else if (transparentIndex !== 0) {
      ;[palette[0], palette[transparentIndex]] = [palette[transparentIndex], palette[0]]
      transparentIndex = 0
    }
    return { palette, format, transparentIndex }
  }

  return { palette, format, transparentIndex: -1 }
}

async function cropAnimatedGif(file, pixelCrop, onProgress) {
  const [{ parseGIF, decompressFrames }, { applyPalette, GIFEncoder, quantize }] = await Promise.all([
    import('gifuct-js'),
    import('gifenc'),
  ])
  const parsed = parseGIF(await file.arrayBuffer())
  const sourceWidth = parsed.lsd.width
  const sourceHeight = parsed.lsd.height
  if (!sourceWidth || !sourceHeight || sourceWidth * sourceHeight > MAX_GIF_SOURCE_PIXELS) {
    throw new Error('GIF 원본 크기가 너무 커요. 프로필용으로 작게 준비해 주세요.')
  }

  const imageFrames = parsed.frames.filter(frame => frame.image)
  const decodedPatchPixels = imageFrames.reduce((total, frame) => total + frame.image.descriptor.width * frame.image.descriptor.height, 0)
  if (imageFrames.length > MAX_GIF_FRAME_COUNT || decodedPatchPixels > MAX_GIF_DECODED_PATCH_PIXELS) {
    throw new Error('GIF가 너무 길거나 커서 처리할 수 없어요. 프로필용으로 더 짧거나 작은 GIF를 준비해 주세요.')
  }

  const frames = decompressFrames(parsed, true).filter(frame => frame?.patch?.length)
  if (frames.length === 0) throw new Error('GIF 프레임을 읽지 못했어요.')

  const crop = makeCrop(pixelCrop, sourceWidth, sourceHeight)
  if (crop.width * crop.height * frames.length > MAX_GIF_CROPPED_FRAME_PIXELS) {
    throw new Error('GIF가 너무 길거나 커서 처리할 수 없어요. 프로필용으로 더 짧거나 작은 GIF를 준비해 주세요.')
  }

  const background = parsed.gct?.[parsed.lsd.backgroundColorIndex] || null
  frames.forEach(frame => { frame.backgroundColor = background })
  const hasTransparency = frames.some(frame => frame.transparentIndex !== undefined)
  const sampleStride = Math.max(1, Math.ceil(frames.length / MAX_PALETTE_SAMPLE_FRAMES))
  const samples = []

  await renderCroppedFrames(
    frames,
    sourceWidth,
    sourceHeight,
    crop,
    (imageData, _frame, index) => {
      if (index % sampleStride === 0 && samples.length < MAX_PALETTE_SAMPLE_FRAMES) samples.push(samplePixels(imageData))
    },
    (done, total) => onProgress?.(Math.round((done / total) * 35))
  )

  const sampleLength = samples.reduce((length, sample) => length + sample.length, 0)
  const paletteSamples = new Uint8ClampedArray(sampleLength)
  let sampleOffset = 0
  for (const sample of samples) {
    paletteSamples.set(sample, sampleOffset)
    sampleOffset += sample.length
  }
  const { palette, format, transparentIndex } = paletteFor(paletteSamples, hasTransparency, quantize)
  const encoder = GIFEncoder()

  await renderCroppedFrames(
    frames,
    sourceWidth,
    sourceHeight,
    crop,
    (imageData, frame, index) => {
      const indexedPixels = applyPalette(imageData.data, palette, format)
      encoder.writeFrame(indexedPixels, crop.width, crop.height, {
        palette: index === 0 ? palette : undefined,
        repeat: index === 0 ? 0 : undefined,
        delay: Math.max(20, frame.delay || 100),
        transparent: hasTransparency,
        transparentIndex,
        dispose: hasTransparency ? 2 : 1,
      })
    },
    (done, total) => onProgress?.(35 + Math.round((done / total) * 65))
  )

  encoder.finish()
  return new File([encoder.bytes()], 'cropped.gif', { type: 'image/gif' })
}

export async function cropProfileImage(file, imageSrc, pixelCrop, onProgress) {
  if (!file || !pixelCrop) throw new Error('이미지 영역을 선택해 주세요.')
  if (file.type === 'image/gif') return cropAnimatedGif(file, pixelCrop, onProgress)
  const result = await cropStillImage(imageSrc, pixelCrop)
  onProgress?.(100)
  return result
}
