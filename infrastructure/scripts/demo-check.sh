#!/usr/bin/env bash
# Pre-presentation infrastructure health check — ~30s total

REGION="us-east-1"
STACKS=(ecom-vpc ecom-sg ecom-rds ecom-alb ecom-asg ecom-cw ecom-media ecom-frontend ecom-s3-artifacts)
ASG_NAME="ecom-asg-prod"
TG_NAME="ecom-tg-prod"
FRONTEND_STACK="ecom-frontend"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; NC='\033[0m'
OK="${GREEN}✓${NC}"; FAIL="${RED}✗${NC}"
SEP="══════════════════════════════════════════════════════"

TMPDIR_CHECK=$(mktemp -d)
trap 'rm -rf "$TMPDIR_CHECK"' EXIT

# ── Phase 1: credentials (fast-fail) ─────────────────────────────────────────

CALLER=$(aws sts get-caller-identity --region "$REGION" --output json 2>/dev/null) || {
  echo -e "\n${RED}${BOLD}ERROR: Credenciales AWS expiradas o inválidas.${NC}"
  echo -e "Ejecuta ${YELLOW}source ./infrastructure/scripts/set-aws-session.sh${NC} primero.\n"
  exit 1
}
ACCOUNT_ID=$(echo "$CALLER" | grep -o '"Account": *"[^"]*"' | grep -o '[0-9]*')
MEDIA_BUCKET="ecom-media-prod-${ACCOUNT_ID}"

# ── Phase 1b: get CloudFront URLs from CF outputs ────────────────────────────

get_cf_output() {
  local stack=$1 key=$2
  aws cloudformation describe-stacks \
    --stack-name "$stack" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" \
    --output text 2>/dev/null
}

BACKEND_URL=$(get_cf_output "$FRONTEND_STACK" "BackendCloudFrontUrl")
FRONTEND_URL=$(get_cf_output "$FRONTEND_STACK" "FrontendCloudFrontUrl")

# ── Check functions ───────────────────────────────────────────────────────────

check_single_stack() {
  local stack=$1
  local status
  status=$(aws cloudformation describe-stacks \
    --stack-name "$stack" --region "$REGION" \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null) || {
    echo "FAIL|no existe o no accesible"
    return
  }
  if [[ "$status" == "CREATE_COMPLETE" || "$status" == "UPDATE_COMPLETE" ]]; then
    echo "PASS|$status"
  else
    echo "FAIL|$status"
  fi
}

check_all_stacks() {
  local pids=() names=()
  for stack in "${STACKS[@]}"; do
    check_single_stack "$stack" > "$TMPDIR_CHECK/stack_${stack}" 2>&1 &
    pids+=($!); names+=("$stack")
  done
  wait "${pids[@]}"

  local all_ok=true failed_list=()
  for stack in "${STACKS[@]}"; do
    local result
    result=$(cat "$TMPDIR_CHECK/stack_${stack}")
    local status="${result%%|*}" msg="${result#*|}"
    if [[ "$status" == "PASS" ]]; then
      printf "  ${OK} %-22s %s\n" "$stack" "$msg"
    else
      printf "  ${FAIL} %-22s %s\n" "$stack" "$msg"
      all_ok=false; failed_list+=("$stack: $msg")
    fi
  done

  if $all_ok; then
    echo "STACKS_OK"
  else
    echo "STACKS_FAIL:$(IFS=';'; echo "${failed_list[*]}")"
  fi
}

check_backend() {
  if [[ -z "$BACKEND_URL" || "$BACKEND_URL" == "None" ]]; then
    echo "FAIL|no se pudo obtener BackendCloudFrontUrl del stack ${FRONTEND_STACK}"
    return
  fi
  local response
  response=$(curl -sf --max-time 10 "${BACKEND_URL}/api/v1/health" 2>/dev/null) || {
    echo "FAIL|connection refused o timeout"
    return
  }
  if echo "$response" | grep -q '"UP"'; then
    echo "PASS|$response"
  else
    echo "FAIL|respuesta inesperada: $response"
  fi
}

check_frontend() {
  if [[ -z "$FRONTEND_URL" || "$FRONTEND_URL" == "None" ]]; then
    echo "FAIL|no se pudo obtener FrontendCloudFrontUrl del stack ${FRONTEND_STACK}"
    return
  fi
  local code
  code=$(curl -so /dev/null -w "%{http_code}" --max-time 10 "$FRONTEND_URL" 2>/dev/null) || {
    echo "FAIL|connection refused o timeout"
    return
  }
  if [[ "$code" == "200" ]]; then
    echo "PASS|HTTP $code"
  else
    echo "FAIL|HTTP $code"
  fi
}

check_alb() {
  local tg_arn
  tg_arn=$(aws elbv2 describe-target-groups \
    --names "$TG_NAME" --region "$REGION" \
    --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null) || {
    echo "FAIL|target group $TG_NAME no encontrado"
    return
  }
  local healthy
  healthy=$(aws elbv2 describe-target-health \
    --target-group-arn "$tg_arn" --region "$REGION" \
    --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' \
    --output text 2>/dev/null)
  local total
  total=$(aws elbv2 describe-target-health \
    --target-group-arn "$tg_arn" --region "$REGION" \
    --query 'length(TargetHealthDescriptions)' \
    --output text 2>/dev/null)
  if [[ "${healthy:-0}" -ge 1 ]]; then
    echo "PASS|${healthy}/${total} healthy"
  else
    echo "FAIL|0/${total:-?} healthy"
  fi
}

check_asg() {
  local info
  info=$(aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names "$ASG_NAME" --region "$REGION" \
    --query 'AutoScalingGroups[0].{desired:DesiredCapacity,inservice:length(Instances[?LifecycleState==`InService`])}' \
    --output text 2>/dev/null) || {
    echo "FAIL|ASG $ASG_NAME no encontrado"
    return
  }
  local desired inservice
  desired=$(echo "$info" | awk '{print $1}')
  inservice=$(echo "$info" | awk '{print $2}')
  if [[ "${inservice:-0}" -ge 1 ]]; then
    echo "PASS|${inservice} InService (desired: ${desired})"
  else
    echo "FAIL|0 InService (desired: ${desired:-?})"
  fi
}

check_media() {
  local count
  count=$(aws s3api list-objects-v2 \
    --bucket "$MEDIA_BUCKET" --region "$REGION" \
    --query 'length(Contents)' --output text 2>/dev/null) || {
    echo "FAIL|bucket $MEDIA_BUCKET no accesible"
    return
  }
  if [[ "$count" != "None" && "${count:-0}" -ge 1 ]]; then
    echo "PASS|${count} objetos en bucket"
  else
    echo "FAIL|bucket vacío o sin objetos"
  fi
}

# ── Phase 2: run all checks in parallel ──────────────────────────────────────

printf "\n${BOLD}%s${NC}\n" "$SEP"
printf "  ${BOLD}DEMO CHECK — ecom-prod — %s${NC}\n" "$(date '+%H:%M:%S')"
printf "${BOLD}%s${NC}\n\n" "$SEP"

# Launch parallel checks (stacks check runs its own internal subshells)
check_all_stacks  > "$TMPDIR_CHECK/stacks"   2>&1 &
check_backend     > "$TMPDIR_CHECK/backend"  2>&1 &
check_frontend    > "$TMPDIR_CHECK/frontend" 2>&1 &
check_alb         > "$TMPDIR_CHECK/alb"      2>&1 &
check_asg         > "$TMPDIR_CHECK/asg"      2>&1 &
check_media       > "$TMPDIR_CHECK/media"    2>&1 &

wait

# ── Phase 3: print results ────────────────────────────────────────────────────

echo -e "[STACKS CLOUDFORMATION]"
# check_all_stacks already printed per-stack lines; last line is the summary token
STACKS_OUTPUT=$(cat "$TMPDIR_CHECK/stacks")
# Print all lines except the last summary token
echo "$STACKS_OUTPUT" | head -n -1

STACKS_SUMMARY=$(echo "$STACKS_OUTPUT" | tail -n 1)

FAILED=()
[[ "$STACKS_SUMMARY" != "STACKS_OK" ]] && {
  IFS=';' read -ra errs <<< "${STACKS_SUMMARY#STACKS_FAIL:}"
  for e in "${errs[@]}"; do FAILED+=("$e"); done
}

print_check() {
  local label=$1 file=$2
  local result
  result=$(cat "$TMPDIR_CHECK/$file")
  local status="${result%%|*}" msg="${result#*|}"
  if [[ "$status" == "PASS" ]]; then
    printf "  ${OK} %-22s %s\n" "$label" "$msg"
  else
    printf "  ${FAIL} %-22s %s\n" "$label" "$msg"
    FAILED+=("$label: $msg")
  fi
}

echo -e "\n[APLICACION]"
print_check "Backend health"     backend
print_check "Frontend accesible" frontend
print_check "ALB target health"  alb
print_check "ASG instancias"     asg
print_check "S3 media"          media

ADMIN_URL="${FRONTEND_URL}/admin"
echo -e "\n[URLS]"
printf "  %-10s %s\n" "Frontend :" "${FRONTEND_URL:-N/A}"
printf "  %-10s %s\n" "Admin    :" "${ADMIN_URL:-N/A}"
printf "  %-10s %s\n" "Backend  :" "${BACKEND_URL:-N/A}"

echo ""
printf "${BOLD}%s${NC}\n" "$SEP"
if [[ ${#FAILED[@]} -eq 0 ]]; then
  printf "  ${GREEN}${BOLD}✓ LISTO PARA PRESENTAR${NC}\n"
else
  printf "  ${RED}${BOLD}✗ HAY PROBLEMAS (%d check(s) fallaron):${NC}\n" "${#FAILED[@]}"
  for f in "${FAILED[@]}"; do
    printf "    ${RED}-${NC} %s\n" "$f"
  done
fi
printf "${BOLD}%s${NC}\n\n" "$SEP"
