#!/usr/bin/env bash
# Sube las imágenes de productos a un bucket S3 de media.
# Uso: ./upload-media.sh <bucket-name>
set -euo pipefail

BUCKET="${1:-}"
if [[ -z "$BUCKET" ]]; then
  echo "Uso: $0 <bucket-name>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRODUCTS_DIR="$ROOT_DIR/frontend/public/products"

if [[ ! -d "$PRODUCTS_DIR" ]]; then
  echo "ERROR: directorio no encontrado: $PRODUCTS_DIR" >&2
  exit 1
fi

echo ">> Bucket destino : s3://${BUCKET}"
echo ">> Origen         : $PRODUCTS_DIR"
echo ""

dirs_ok=0
main_ok=0
gallery_ok=0

for product_dir in "$PRODUCTS_DIR"/*/; do
  [[ -d "$product_dir" ]] || continue
  N="$(basename "$product_dir")"

  # main.png
  if [[ -f "$product_dir/main.png" ]]; then
    aws s3 cp "$product_dir/main.png" \
      "s3://${BUCKET}/products/${N}/main.png" \
      --content-type image/png \
      --quiet
    echo "  [${N}] main.png"
    (( main_ok++ )) || true
  fi

  # gallery/
  if [[ -d "$product_dir/gallery" ]]; then
    for img in "$product_dir/gallery"/*; do
      [[ -f "$img" ]] || continue
      filename="$(basename "$img")"
      aws s3 cp "$img" \
        "s3://${BUCKET}/products/${N}/gallery/${filename}" \
        --content-type image/png \
        --quiet
      echo "  [${N}] gallery/${filename}"
      (( gallery_ok++ )) || true
    done
  fi

  (( dirs_ok++ )) || true
done

echo ""
echo "============================================"
echo "  Directorios procesados : ${dirs_ok}"
echo "  main.png subidos       : ${main_ok}"
echo "  gallery/* subidos      : ${gallery_ok}"
echo "  Total archivos         : $(( main_ok + gallery_ok ))"
echo "============================================"
