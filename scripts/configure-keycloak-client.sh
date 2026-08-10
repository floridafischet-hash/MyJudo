#!/usr/bin/env bash
set -euo pipefail

keycloak_internal_url="${KEYCLOAK_INTERNAL_URL:-http://keycloak:8080/keycloak}"
realm="${KEYCLOAK_REALM:-myjudo}"
client_id="${KEYCLOAK_CLIENT_ID:-myjudo-client}"
: "${KEYCLOAK_ADMIN_USERNAME:?KEYCLOAK_ADMIN_USERNAME is required}"
: "${KEYCLOAK_ADMIN_PASSWORD:?KEYCLOAK_ADMIN_PASSWORD is required}"

admin_token="$(curl -fsS \
  --data-urlencode 'grant_type=password' \
  --data-urlencode 'client_id=admin-cli' \
  --data-urlencode "username=$KEYCLOAK_ADMIN_USERNAME" \
  --data-urlencode "password=$KEYCLOAK_ADMIN_PASSWORD" \
  "$keycloak_internal_url/realms/master/protocol/openid-connect/token" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.access_token)process.exit(1);process.stdout.write(j.access_token)})')"

client_uuid="$(curl -fsS -H "Authorization: Bearer $admin_token" \
  "$keycloak_internal_url/admin/realms/$realm/clients?clientId=$client_id" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(j.length!==1)process.exit(1);process.stdout.write(j[0].id)})')"
basic_scope_uuid="$(curl -fsS -H "Authorization: Bearer $admin_token" \
  "$keycloak_internal_url/admin/realms/$realm/client-scopes" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s).find(x=>x.name==="basic");if(!j)process.exit(1);process.stdout.write(j.id)})')"

status="$(curl -sS -o /dev/null -w '%{http_code}' -X PUT \
  -H "Authorization: Bearer $admin_token" \
  "$keycloak_internal_url/admin/realms/$realm/clients/$client_uuid/default-client-scopes/$basic_scope_uuid")"
test "$status" = "204"
echo "keycloak_client_scopes_configured"
