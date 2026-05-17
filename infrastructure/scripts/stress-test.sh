#!/usr/bin/env bash
# stress-test.sh — lanza stress en la instancia EC2 del ASG y monitorea el scale-out
# Idempotente: puede ejecutarse multiples veces sin fallar
#
# Uso:
#   ./stress-test.sh               # lanza stress + monitorea
#   ./stress-test.sh --monitor-only  # solo metricas (util para ver scale-in)

set -uo pipefail   # -e omitido: CloudWatch puede devolver vacio sin que sea error

# -- CONFIGURACION ────────────────────────────────────────────────────────────
REGION="us-east-1"
ASG_NAME="ecom-asg-prod"
BASTION_SG="ecom-sg-bastion-prod"
KEY="$HOME/.ssh/ecom-keypair.pem"
SSH_USER="ec2-user"
STRESS_DURATION=300
POLL_INTERVAL=20
MONITOR_ONLY=false

# -- ARGUMENTOS ───────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --monitor-only) MONITOR_ONLY=true ;;
    *) echo "ERROR: opcion desconocida: $arg" && exit 1 ;;
  esac
done

# -- HELPERS ──────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Timestamp UTC hace N minutos — compatible con GNU date (Linux) y BSD date (macOS)
minutes_ago() {
  local n=$1
  date -u -d "${n} minutes ago" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
    || date -u -v-"${n}M" '+%Y-%m-%dT%H:%M:%SZ'
}

now_utc() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

get_cpu() {
  aws cloudwatch get-metric-statistics \
    --region "$REGION" \
    --namespace AWS/EC2 \
    --metric-name CPUUtilization \
    --dimensions "Name=AutoScalingGroupName,Value=$ASG_NAME" \
    --start-time "$(minutes_ago 5)" \
    --end-time   "$(now_utc)" \
    --period 60 \
    --statistics Average \
    --query "sort_by(Datapoints, &Timestamp)[-1].Average" \
    --output text 2>/dev/null || echo "N/A"
}

get_asg_state() {
  aws autoscaling describe-auto-scaling-groups \
    --region "$REGION" \
    --auto-scaling-group-names "$ASG_NAME" \
    --query "AutoScalingGroups[0].[DesiredCapacity, \
             length(Instances[?LifecycleState=='InService'])]" \
    --output text 2>/dev/null || echo "N/A N/A"
}

# -- DESCUBRIMIENTO DE HOSTS ──────────────────────────────────────────────────
discover_hosts() {
  log "Obteniendo IP publica del Bastion (SG: $BASTION_SG)..."
  BASTION_IP=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters "Name=instance.group-name,Values=$BASTION_SG" \
              "Name=instance-state-name,Values=running" \
    --query "Reservations[0].Instances[0].PublicIpAddress" \
    --output text 2>/dev/null)

  if [ -z "$BASTION_IP" ] || [ "$BASTION_IP" = "None" ]; then
    log "ERROR: No se encontro el Bastion Host con SG '$BASTION_SG' en estado running."
    exit 1
  fi
  log "Bastion IP: $BASTION_IP"

  log "Obteniendo IP privada de la instancia del ASG ($ASG_NAME)..."
  APP_IP=$(aws ec2 describe-instances \
    --region "$REGION" \
    --filters "Name=tag:aws:autoscaling:groupName,Values=$ASG_NAME" \
              "Name=instance-state-name,Values=running" \
    --query "Reservations[0].Instances[0].PrivateIpAddress" \
    --output text 2>/dev/null)

  if [ -z "$APP_IP" ] || [ "$APP_IP" = "None" ]; then
    log "ERROR: No se encontro ninguna instancia running en el ASG '$ASG_NAME'."
    exit 1
  fi
  log "App IP (privada): $APP_IP"
}

# -- LANZAR STRESS ────────────────────────────────────────────────────────────
launch_stress() {
  local ssh_opts="-i $KEY -o StrictHostKeyChecking=no -o ConnectTimeout=15 -o BatchMode=yes"
  local proxy="-o ProxyJump=${SSH_USER}@${BASTION_IP}"

  log "Conectando: local -> Bastion ($BASTION_IP) -> App ($APP_IP) via ProxyJump..."

  eval $(ssh-agent) >/dev/null 2>&1
  ssh-add ~/.ssh/ecom-keypair.pem 2>/dev/null

  ssh $ssh_opts $proxy "${SSH_USER}@${APP_IP}" \
    "which stress >/dev/null 2>&1 \
       || sudo dnf install stress -y -q; \
     nohup stress --cpu 4 --timeout ${STRESS_DURATION} \
       >/tmp/stress.log 2>&1 </dev/null &
     echo \"stress PID: \$!\"" \
    && log "stress lanzado en $APP_IP (timeout: ${STRESS_DURATION}s)" \
    || { log "ERROR: Fallo la conexion SSH o el lanzamiento de stress."; exit 1; }
}

# -- BUCLE DE MONITOREO ───────────────────────────────────────────────────────
monitor_loop() {
  local start=$SECONDS
  local scaled=false

  if $MONITOR_ONLY; then
    log "Modo --monitor-only activado. Ctrl-C para salir."
    log "CloudWatch tarda 2-3 min en reflejar CPU. Scale-in: 5-15 min tras bajar CPU."
  else
    log "Monitoreando por ${STRESS_DURATION}s (CloudWatch actualiza cada ~60s)..."
  fi

  echo ""
  printf "%-12s %-12s %-10s %-12s %s\n" "HORA" "CPU (avg)" "DESIRED" "INSERVICE" "ELAPSED"
  printf '%0.s-' {1..58}; echo

  while true; do
    local elapsed=$(( SECONDS - start ))
    local cpu
    cpu=$(get_cpu)

    local desired inservice
    read -r desired inservice < <(get_asg_state)

    printf "%-12s %-12s %-10s %-12s +%ss\n" \
      "$(date '+%H:%M:%S')" \
      "${cpu}%" \
      "${desired}" \
      "${inservice}" \
      "${elapsed}"

    if [ "${desired:-0}" -ge 2 ] && [ "$scaled" = false ]; then
      scaled=true
      echo ""
      log "SCALE-OUT DETECTADO -- ASG escalo a $desired instancias"
      echo ""
    fi

    if $MONITOR_ONLY; then
      sleep "$POLL_INTERVAL"
    else
      if [ "$elapsed" -ge "$STRESS_DURATION" ]; then
        break
      fi
      sleep "$POLL_INTERVAL"
    fi
  done

  if ! $MONITOR_ONLY; then
    echo ""
    printf '%0.s=' {1..58}; echo
    log "TEST FINALIZADO -- duracion: ${STRESS_DURATION}s"
    if $scaled; then
      log "RESULTADO: PASS -- Scale-out verificado correctamente"
    else
      log "RESULTADO: WARN -- No se detecto scale-out durante el test"
      log "  -> Verifica CloudWatch (puede tardar 2-3 min extra)"
      log "  -> Usa --monitor-only para seguir monitoreando"
    fi
    log "Scale-in (volver a 1 instancia) tardara 5-15 min mas."
    log "Para seguir viendo metricas:  ./stress-test.sh --monitor-only"
    printf '%0.s=' {1..58}; echo
  fi
}

# -- MAIN ─────────────────────────────────────────────────────────────────────
echo ""
log "============= STRESS TEST -- ecom-asg-prod ============="
log "Modo: $( $MONITOR_ONLY && echo 'solo monitoreo' || echo "stress ${STRESS_DURATION}s + monitoreo" )"
echo ""

if ! $MONITOR_ONLY; then
  [ -f "$KEY" ] || { log "ERROR: Llave SSH no encontrada en $KEY"; exit 1; }
  discover_hosts
  launch_stress
fi

monitor_loop
