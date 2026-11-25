/**
 * A picked photo as a base64 JPEG, longest side at most `maxDimension` — the same limits as
 * Android's ImageProcessor.loadAndDownscale, so both apps send the scan function the same size.
 * An <img> applies EXIF orientation, and drawImage keeps it, so phone photos arrive upright.
 * iOS hands over HEIC photos as JPEG when they come through a file input.
 */
export async function downscaleToJpeg(file: Blob, maxDimension = 1024, quality = 0.85): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode().catch(() => { throw new Error('Could not read that image.') })
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not read that image.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality).replace(/^data:image\/jpeg;base64,/, '')
  } finally {
    URL.revokeObjectURL(url)
  }
}
