const MEDIA_URL = import.meta.env.VITE_MEDIA_BUCKET_URL

export function getImageUrl(productId, index = 'main') {
  if (!MEDIA_URL) {
    return index === 'main'
      ? `/products/${productId}/main.png`
      : `/products/${productId}/gallery/${index}.png`
  }
  return index === 'main'
    ? `${MEDIA_URL}/products/${productId}/main.png`
    : `${MEDIA_URL}/products/${productId}/gallery/${index}.png`
}
