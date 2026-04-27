#!/bin/bash
# Sube todos los templates de CloudFormation al bucket S3 de artefactos.
# Si el bucket no existe, despliega 00-s3-artifacts primero (bootstrap).
#
# Uso: ./upload-templates.sh [environment]
#   environment: prod (default), dev, staging
set -e

ENVIRONMENT="${1:-prod}"
REGION="us-east-1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR}/../cloudformation"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET="ecom-artifacts-${ENVIRONMENT}-${ACCOUNT_ID}"
PREFIX="cloudformation"

echo "=== upload-templates.sh | entorno: ${ENVIRONMENT} | bucket: ${BUCKET} ==="

# ---------------------------------------------------------------------------
# Bootstrap: crear el bucket si no existe desplegando 00-s3-artifacts
# ---------------------------------------------------------------------------
echo ""
echo ">>> Verificando bucket S3..."

if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Bucket no encontrado. Desplegando stack 00-s3-artifacts para crearlo..."
  aws cloudformation deploy \
    --template-file "${TEMPLATE_DIR}/00-s3-artifacts.yaml" \
    --stack-name ecom-s3-artifacts \
    --parameter-overrides Environment="${ENVIRONMENT}" \
    --region "$REGION" \
    --no-fail-on-empty-changeset
  echo "Stack ecom-s3-artifacts desplegado."
else
  echo "Bucket '${BUCKET}' ya existe."
fi

# ---------------------------------------------------------------------------
# Subir todos los .yaml al prefijo cloudformation/
# ---------------------------------------------------------------------------
echo ""
echo ">>> Subiendo templates..."
echo ""

count=0
for template in "${TEMPLATE_DIR}"/*.yaml; do
  filename=$(basename "$template")
  aws s3 cp "$template" "s3://${BUCKET}/${PREFIX}/${filename}" \
    --region "$REGION" \
    --quiet
  echo "  https://s3.amazonaws.com/${BUCKET}/${PREFIX}/${filename}"
  count=$((count + 1))
done

# ---------------------------------------------------------------------------
# Key pair: crear ecom-keypair si no existe en AWS
# ---------------------------------------------------------------------------
echo ""
echo ">>> Verificando key pair ecom-keypair..."

KEY_NAME="ecom-keypair"
PEM_PATH="${HOME}/.ssh/${KEY_NAME}.pem"

if aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &>/dev/null; then
  echo "Key pair '${KEY_NAME}' ya existe en AWS."
else
  echo "Key pair no encontrado. Creando '${KEY_NAME}'..."

  # Eliminar archivo local previo para evitar errores de permisos al sobreescribir
  if [[ -f "$PEM_PATH" ]]; then
    rm -f "$PEM_PATH"
    echo "Archivo local previo '${PEM_PATH}' eliminado."
  fi

  aws ec2 create-key-pair \
    --key-name "$KEY_NAME" \
    --query "KeyMaterial" \
    --output text \
    --region "$REGION" > "$PEM_PATH"

  chmod 400 "$PEM_PATH"
  echo "Key pair creado y guardado en '${PEM_PATH}' (permisos 400)."
fi

# ---------------------------------------------------------------------------
# Resumen y siguiente paso
# ---------------------------------------------------------------------------
echo ""
echo "=== ${count} template(s) subidos correctamente ==="
echo ""
echo "Para desplegar el stack principal ejecuta:"
echo ""
echo "  aws cloudformation create-stack \\"
echo "    --stack-name ecom-main-${ENVIRONMENT} \\"
echo "    --template-url https://s3.amazonaws.com/${BUCKET}/${PREFIX}/main.yaml \\"
echo "    --parameters \\"
echo "        ParameterKey=Environment,ParameterValue=${ENVIRONMENT} \\"
echo "        ParameterKey=DBPassword,ParameterValue=<password> \\"
echo "        ParameterKey=AlertEmail,ParameterValue=<email> \\"
echo "        ParameterKey=IamInstanceProfile,ParameterValue=<profile-name> \\"
echo "    --region ${REGION}"
echo ""
echo "Obtén el IamInstanceProfile con:"
echo "  aws iam list-instance-profiles --query 'InstanceProfiles[0].InstanceProfileName' --output text"
