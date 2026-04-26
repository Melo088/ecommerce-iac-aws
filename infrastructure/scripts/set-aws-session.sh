#!/bin/bash

echo "=== AWS Academy Session Setup ==="
echo ""

read -p "AWS_ACCESS_KEY_ID:     " access_key
read -p "AWS_SECRET_ACCESS_KEY: " secret_key
read -p "AWS_SESSION_TOKEN:     " session_token

export AWS_ACCESS_KEY_ID="$access_key"
export AWS_SECRET_ACCESS_KEY="$secret_key"
export AWS_SESSION_TOKEN="$session_token"
export AWS_DEFAULT_REGION="us-east-1"

echo ""
aws sts get-caller-identity && echo "Sesión configurada" || echo "Algo falló, revisa las keys"
