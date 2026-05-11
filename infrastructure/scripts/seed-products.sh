#!/usr/bin/env bash
# Seed products from mockYeezyDeep.json into data.sql and downloads product images.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_SQL="$ROOT_DIR/backend/src/main/resources/data.sql"
PRODUCTS_DIR="$ROOT_DIR/frontend/public/products"
JSON_FILE="$HOME/University/InfraIII/final_project/yeezy_scrapping/mockYeezyDeep.json"

# ── Checks ────────────────────────────────────────────────────────────────────
if [[ ! -f "$JSON_FILE" ]]; then
  echo "ERROR: JSON no encontrado en $JSON_FILE" >&2
  exit 1
fi

command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 requerido" >&2; exit 1; }
command -v curl    >/dev/null 2>&1 || { echo "ERROR: curl requerido"    >&2; exit 1; }

# ── Limpieza ──────────────────────────────────────────────────────────────────
echo ">> Limpiando data.sql..."
> "$DATA_SQL"

echo ">> Limpiando $PRODUCTS_DIR..."
rm -rf "$PRODUCTS_DIR"
mkdir -p "$PRODUCTS_DIR"

# ── Procesamiento ─────────────────────────────────────────────────────────────
echo ">> Procesando productos..."
echo ""

python3 - "$DATA_SQL" "$PRODUCTS_DIR" "$JSON_FILE" <<'PYEOF'
import json, sys, os, subprocess, random

data_sql_path = sys.argv[1]
products_dir  = sys.argv[2]
json_path     = sys.argv[3]

CATEGORY_MAP = {
    # Footwear
    "YS": "FOOTWEAR",   # Yeezy Slide
    "SL": "FOOTWEAR",   # Molded Slide
    "HL": "FOOTWEAR",   # Heels / Mules / Wedges
    "HB": "FOOTWEAR",   # High Boot
    "PD": "FOOTWEAR",   # Knitted Sneaker
    # Tops
    "TS": "TOPS",       # T-Shirt
    "LS": "TOPS",       # Long Sleeve
    "TT": "TOPS",       # Tank / Tube Top
    "BD": "TOPS",       # Bodysuit / Jumpsuit / Romper
    "HD": "TOPS",       # Hoodie
    # Outerwear
    "JC": "OUTERWEAR",  # Jacket
    "BB": "OUTERWEAR",  # Bomber
    "WB": "OUTERWEAR",  # Windbreaker
    "WJ": "OUTERWEAR",  # Work Jacket / Track Jacket
    # Bottoms
    "WD": "BOTTOMS",    # Work Denim
    "WP": "BOTTOMS",    # Work Pant
    "PT": "BOTTOMS",    # Pants
    "LG": "BOTTOMS",    # Leggings
    "SH": "BOTTOMS",    # Shorts
    "SP": "BOTTOMS",    # Sweatpants
    # Underwear
    "BX": "UNDERWEAR",  # Boxer Briefs
    "BR": "UNDERWEAR",  # Bralette
    "UW": "UNDERWEAR",  # Underwear / Thong
    # Accessories
    "SG": "ACCESSORIES",  # Sunglasses
    "BG": "ACCESSORIES",  # Duffle Bag
    "BP": "ACCESSORIES",  # Backpack
    "BT": "ACCESSORIES",  # Belt
    "SK": "ACCESSORIES",  # Socks
    "WH": "ACCESSORIES",  # Hat (Cadet / Military)
}

with open(json_path) as f:
    products = json.load(f)

sql_values = []
imgs_ok    = 0
imgs_fail  = 0

for idx, p in enumerate(products, start=1):
    price    = random.choice(range(20, 310, 10))
    stock    = random.randint(10, 50)
    category = CATEGORY_MAP.get(p["codigo"], "ACCESSORIES")

    # SQL-safe strings
    name = p["nombre"].replace("'", "''")
    desc = p["descripcion"].replace("\n", " ").replace("'", "''")

    # Download first image
    product_dir = os.path.join(products_dir, str(idx))
    os.makedirs(product_dir, exist_ok=True)
    img_path    = os.path.join(product_dir, "main.png")
    image_url   = f"/products/{idx}/main.png"

    if p.get("imagenes"):
        url    = p["imagenes"][0]
        result = subprocess.run(
            ["curl", "-sL", "--max-time", "30", "-o", img_path, url],
            capture_output=True,
        )
        if result.returncode == 0 and os.path.exists(img_path) and os.path.getsize(img_path) > 0:
            imgs_ok += 1
            img_sql = f"'{image_url}'"
        else:
            imgs_fail += 1
            print(f"  [WARN] #{idx:02d} {p['nombre']}: imagen no descargada")
            img_sql = "NULL"
    else:
        imgs_fail += 1
        img_sql = "NULL"

    sql_values.append(
        f"  ('{name}', '{desc}', '{category}', {price}.00, {stock}, {img_sql}, NOW())"
    )
    status = "OK" if img_sql != "NULL" else "NO IMG"
    print(f"  [{idx:02d}/{len(products)}] {p['nombre']:<10} | {category:<12} | ${price:>3} | stock {stock:>2} | {status}")

# Write data.sql
with open(data_sql_path, "w") as f:
    f.write("INSERT INTO products (name, description, category, price, stock, image_url, created_at) VALUES\n")
    for i, val in enumerate(sql_values):
        sep = ";" if i == len(sql_values) - 1 else ","
        f.write(f"{val}{sep}\n")

# Summary
print()
print("=" * 50)
print(f"  Productos procesados  : {len(products)}")
print(f"  Imágenes descargadas  : {imgs_ok}")
print(f"  Imágenes fallidas     : {imgs_fail}")
print(f"  data.sql generado en  : {data_sql_path}")
print(f"  Imágenes guardadas en : {products_dir}")
print("=" * 50)
PYEOF
