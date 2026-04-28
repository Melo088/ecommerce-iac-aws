const S3        = import.meta.env.VITE_S3_BUCKET
const USE_LOCAL = import.meta.env.VITE_USE_LOCAL_IMAGES === 'true'

/**
 * Builds the URL for a product image.
 * index = 'main' → main.png
 * index = 1,2,3… → gallery/1.png, gallery/2.png, …
 */
export function getImageUrl(productId, index = 'main') {
  const isMain = index === 'main'

  if (USE_LOCAL) {
    return isMain
      ? `/products/${productId}/main.png`
      : `/products/${productId}/gallery/${index}.png`
  }

  return isMain
    ? `https://${S3}.s3.amazonaws.com/products/${productId}/main.png`
    : `https://${S3}.s3.amazonaws.com/products/${productId}/gallery/${index}.png`
}
