#!/bin/bash
set -e

echo "=== Desplegando todos los stacks ==="

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

echo ""
echo "=== Todo desplegado ==="
