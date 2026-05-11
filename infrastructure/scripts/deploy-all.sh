#!/bin/bash
set -e

echo "=== Desplegando todos los stacks ==="

read -rp  "Email para alertas SNS (AlertEmail):        " ALERT_EMAIL
read -rsp "Contraseña RDS (DBPassword):               " DB_PASSWORD
echo
read -rsp "MercadoPago access token (MpAccessToken):  " MP_ACCESS_TOKEN
echo
read -rsp "JWT secret (JwtSecret, min 32 chars):      " JWT_SECRET
echo

IAM_PROFILE=$(aws iam list-instance-profiles --query 'InstanceProfiles[0].InstanceProfileName' --output text)

deploy() {
  local name=$1
  local template=$2
  shift 2
  echo ""
  echo ">>> $name"
  aws cloudformation create-stack \
    --stack-name $name \
    --template-body file://$template \
    --region us-east-1 "$@"
  aws cloudformation wait stack-create-complete --stack-name $name
  echo "$name listo"
}

echo ""
echo ">>> ecom-s3-artifacts"
if aws cloudformation describe-stacks --stack-name ecom-s3-artifacts --region us-east-1 &>/dev/null; then
  echo "ecom-s3-artifacts ya existe, omitiendo creación"
else
  aws cloudformation create-stack \
    --stack-name ecom-s3-artifacts \
    --template-body file://infrastructure/cloudformation/00-s3-artifacts.yaml \
    --region us-east-1
  aws cloudformation wait stack-create-complete --stack-name ecom-s3-artifacts
  echo "ecom-s3-artifacts listo"
fi

# CloudTrail no está disponible en el sandbox de AWS Academy por restricciones de IAM
# (el rol de laboratorio no tiene permisos para crear trails ni escribir en S3 desde CloudTrail).

deploy ecom-vpc infrastructure/cloudformation/01-vpc.yaml

deploy ecom-sg infrastructure/cloudformation/02-security-groups.yaml

deploy ecom-rds infrastructure/cloudformation/03-rds.yaml \
  --parameters \
    ParameterKey=VpcStackName,ParameterValue=ecom-vpc \
    ParameterKey=SgStackName,ParameterValue=ecom-sg \
    ParameterKey=DBPassword,ParameterValue=$DB_PASSWORD

deploy ecom-alb infrastructure/cloudformation/04-alb.yaml \
  --parameters \
    ParameterKey=VpcStackName,ParameterValue=ecom-vpc \
    ParameterKey=SgStackName,ParameterValue=ecom-sg

echo ""
echo ">>> Verificando key pair ecom-keypair"
if ! aws ec2 describe-key-pairs --key-names ecom-keypair --region us-east-1 &>/dev/null; then
  echo "Key pair no encontrado. Creando ecom-keypair..."
  mkdir -p ~/.ssh
  aws ec2 create-key-pair \
    --key-name ecom-keypair \
    --region us-east-1 \
    --query 'KeyMaterial' \
    --output text > ~/.ssh/ecom-keypair.pem
  chmod 400 ~/.ssh/ecom-keypair.pem
  echo "Key pair creado y guardado en ~/.ssh/ecom-keypair.pem"
else
  echo "Key pair ecom-keypair ya existe en AWS."
fi

deploy ecom-asg infrastructure/cloudformation/05-autoscaling.yaml \
  --parameters \
    ParameterKey=KeyName,ParameterValue=ecom-keypair \
    ParameterKey=S3BucketName,ParameterValue=ecom-artifacts-prod-$(aws sts get-caller-identity --query Account --output text) \
    ParameterKey=S3JarPath,ParameterValue=backend/ecom-app.jar \
    ParameterKey=VpcStackName,ParameterValue=ecom-vpc \
    ParameterKey=SgStackName,ParameterValue=ecom-sg \
    ParameterKey=RdsStackName,ParameterValue=ecom-rds \
    ParameterKey=AlbStackName,ParameterValue=ecom-alb \
    ParameterKey=DBPassword,ParameterValue=$DB_PASSWORD \
    ParameterKey=MpAccessToken,ParameterValue=$MP_ACCESS_TOKEN \
    ParameterKey=JwtSecret,ParameterValue=$JWT_SECRET \
    ParameterKey=IamInstanceProfile,ParameterValue=$IAM_PROFILE \
    ParameterKey=S3MediaBucket,ParameterValue=ecom-media-prod-$(aws sts get-caller-identity --query Account --output text) \
    ParameterKey=AwsRegion,ParameterValue=us-east-1

deploy ecom-cw infrastructure/cloudformation/06-cloudwatch.yaml \
  --parameters \
    ParameterKey=AsgStackName,ParameterValue=ecom-asg \
    ParameterKey=AlbStackName,ParameterValue=ecom-alb \
    ParameterKey=AlertEmail,ParameterValue=$ALERT_EMAIL

# ── ecom-media (bucket S3 + CloudFront para imágenes de productos) ───────────
echo ""
echo ">>> ecom-media"
if aws cloudformation describe-stacks --stack-name ecom-media --region us-east-1 &>/dev/null; then
  echo "ecom-media ya existe, omitiendo creación"
else
  aws cloudformation create-stack \
    --stack-name ecom-media \
    --template-body file://infrastructure/cloudformation/08-media.yaml \
    --region us-east-1
  aws cloudformation wait stack-create-complete --stack-name ecom-media
  echo "ecom-media listo"
fi

MEDIA_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name ecom-media \
  --query 'Stacks[0].Outputs[?OutputKey==`MediaBucketName`].OutputValue' \
  --output text)

MEDIA_CF_URL=$(aws cloudformation describe-stacks \
  --stack-name ecom-media \
  --query 'Stacks[0].Outputs[?OutputKey==`MediaCloudFrontUrl`].OutputValue' \
  --output text)

# ── Subir imágenes de productos al bucket de media ───────────────────────────
echo ""
echo ">>> upload-media → s3://${MEDIA_BUCKET}"
"$(dirname "$0")/upload-media.sh" "$MEDIA_BUCKET"

# ── ecom-frontend (S3 + CloudFront para el build de React) ───────────────────
echo ""
echo ">>> ecom-frontend"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if aws cloudformation describe-stacks --stack-name ecom-frontend --region us-east-1 &>/dev/null; then
  echo "ecom-frontend ya existe, omitiendo creación"
else
  aws cloudformation create-stack \
    --stack-name ecom-frontend \
    --template-url "https://s3.us-east-1.amazonaws.com/ecom-artifacts-prod-${ACCOUNT_ID}/cloudformation/07-frontend.yaml" \
    --parameters ParameterKey=AlbStackName,ParameterValue=ecom-alb \
    --region us-east-1
  aws cloudformation wait stack-create-complete --stack-name ecom-frontend
  echo "ecom-frontend listo"
fi

BACKEND_CF=$(aws cloudformation describe-stacks \
  --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendCloudFrontUrl`].OutputValue' \
  --output text)
FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)
FRONTEND_DIST=$(aws cloudformation describe-stacks \
  --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendDistributionId`].OutputValue' \
  --output text)

echo ""
echo "=== Todo desplegado ==="
echo ""
echo "URLs relevantes:"
echo "  Backend  (VITE_API_URL)        : ${BACKEND_CF}"
echo "  Media CDN (VITE_MEDIA_BUCKET_URL): ${MEDIA_CF_URL}"
echo "  Frontend bucket                : s3://${FRONTEND_BUCKET}"
echo "  Frontend distribution          : ${FRONTEND_DIST}"
echo ""
echo "Próximo paso — compilar y subir el frontend:"
echo "  cd frontend"
echo "  VITE_API_URL=${BACKEND_CF} \\"
echo "  VITE_MEDIA_BUCKET_URL=${MEDIA_CF_URL} \\"
echo "  VITE_MP_PUBLIC_KEY=<public-key> \\"
echo "  npm run build"
echo "  aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete"
echo "  aws cloudfront create-invalidation --distribution-id ${FRONTEND_DIST} --paths '/*'"
