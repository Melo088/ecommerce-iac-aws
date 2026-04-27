#!/bin/bash
set -e

echo "=== Desplegando todos los stacks ==="

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

deploy ecom-s3-artifacts infrastructure/cloudformation/00-s3-artifacts.yaml

deploy ecom-vpc infrastructure/cloudformation/01-vpc.yaml

deploy ecom-sg infrastructure/cloudformation/02-security-groups.yaml

deploy ecom-rds infrastructure/cloudformation/03-rds.yaml \
  --parameters \
    ParameterKey=VpcStackName,ParameterValue=ecom-vpc \
    ParameterKey=SgStackName,ParameterValue=ecom-sg \
    ParameterKey=DBPassword,ParameterValue=SuperPassword123!

deploy ecom-alb infrastructure/cloudformation/04-alb.yaml \
  --parameters \
    ParameterKey=VpcStackName,ParameterValue=ecom-vpc \
    ParameterKey=SgStackName,ParameterValue=ecom-sg

deploy ecom-asg infrastructure/cloudformation/05-autoscaling.yaml \
  --parameters \
    ParameterKey=KeyName,ParameterValue=ecom-keypair \
    ParameterKey=S3BucketName,ParameterValue=ecom-artifacts-prod-$(aws sts get-caller-identity --query Account --output text) \
    ParameterKey=S3JarPath,ParameterValue=backend/ecom-app.jar \
    ParameterKey=VpcStackName,ParameterValue=ecom-vpc \
    ParameterKey=SgStackName,ParameterValue=ecom-sg \
    ParameterKey=RdsStackName,ParameterValue=ecom-rds \
    ParameterKey=AlbStackName,ParameterValue=ecom-alb \
    ParameterKey=DBPassword,ParameterValue=SuperPassword123! \
    ParameterKey=IamInstanceProfile,ParameterValue=$IAM_PROFILE

echo ""
echo "=== Todo desplegado ==="
