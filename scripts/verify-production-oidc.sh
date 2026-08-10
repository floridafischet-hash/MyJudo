#!/usr/bin/env bash
set -euo pipefail
trap 'echo "OIDC verification failed at line $LINENO" >&2' ERR

username="${1:?username required}"
password="${2:?password required}"
echo "verifying=$username"
base_url="${MYJUDO_PUBLIC_URL:-https://212.227.20.171:18780}"
client_id="${KEYCLOAK_CLIENT_ID:-myjudo-client}"
redirect_uri="$base_url/auth.html"
cookie_jar="$(mktemp)"
login_page="$(mktemp)"
headers="$(mktemp)"
trap 'rm -f "$cookie_jar" "$login_page" "$headers"' EXIT

verifier="$(openssl rand -base64 64 | tr -d '=+/\n' | head -c 64)"
challenge="$(printf '%s' "$verifier" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')"
state="$(openssl rand -hex 16)"
nonce="$(openssl rand -hex 16)"

curl -ksS -c "$cookie_jar" -G \
  --data-urlencode "client_id=$client_id" \
  --data-urlencode "redirect_uri=$redirect_uri" \
  --data-urlencode "response_type=code" \
  --data-urlencode "scope=openid profile email" \
  --data-urlencode "code_challenge=$challenge" \
  --data-urlencode "code_challenge_method=S256" \
  --data-urlencode "state=$state" \
  --data-urlencode "nonce=$nonce" \
  "$base_url/keycloak/realms/myjudo/protocol/openid-connect/auth" > "$login_page"

action="$(grep -o 'action="[^"]*"' "$login_page" | head -n 1 | cut -d '"' -f 2 | sed 's/&amp;/\&/g')"
test -n "$action"

curl -ksS -b "$cookie_jar" -c "$cookie_jar" -D "$headers" -o /dev/null \
  --data-urlencode "username=$username" \
  --data-urlencode "password=$password" \
  --data-urlencode "credentialId=" \
  "$action"

location="$(awk 'BEGIN{IGNORECASE=1} /^location:/{sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); print; exit}' "$headers")"
code="$(printf '%s' "$location" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')"
returned_state="$(printf '%s' "$location" | sed -n 's/.*[?&]state=\([^&]*\).*/\1/p')"
test -n "$code"
test "$returned_state" = "$state"

token_response="$(curl -ksS \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "client_id=$client_id" \
  --data-urlencode "redirect_uri=$redirect_uri" \
  --data-urlencode "code=$code" \
  --data-urlencode "code_verifier=$verifier" \
  "$base_url/keycloak/realms/myjudo/protocol/openid-connect/token")"
access_token="$(printf '%s' "$token_response" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.access_token)process.exit(1);process.stdout.write(j.access_token)})')"
token_username="$(printf '%s' "$access_token" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(Buffer.from(s.split(".")[1],"base64url"));process.stdout.write(p.preferred_username ?? "")})')"
token_subject="$(printf '%s' "$access_token" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(Buffer.from(s.split(".")[1],"base64url"));process.stdout.write(p.sub ?? "")})')"
test "$token_username" = "$username"
test -n "$token_subject"
echo "token=$token_username|$token_subject"

profile="$(curl -ksS -H "Authorization: Bearer $access_token" "$base_url/api/v1/auth/me")"
printf '%s' "$profile" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.firstName)process.exit(1);console.log(`${j.username}|${j.firstName}|approved|${j.permissions.length}`)})'
