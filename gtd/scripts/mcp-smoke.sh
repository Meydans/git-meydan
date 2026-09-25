#!/bin/bash
# Checks the MCP endpoint end to end with the static API_TOKEN. Read-only: it creates nothing.
# Usage: scripts/mcp-smoke.sh https://your-app.vercel.app "$API_TOKEN"
B=${1:?usage: mcp-smoke.sh BASE_URL TOKEN}; T=${2:?usage: mcp-smoke.sh BASE_URL TOKEN}
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1 (expected $2, got $3)"; fi; }
rpc() { # method params [token]
  curl -s -X POST "$B/api/mcp" -H "Authorization: Bearer ${3:-$T}" -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' -H 'MCP-Protocol-Version: 2025-06-18' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$1\",\"params\":$2}" | sed -n 's/^data: //p; /^{/p' | head -1; }
field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(eval("JSON.parse(s)"+process.argv[1]))}catch{console.log("unparseable")}})' "$1"; }

check "discovery: protected resource metadata" "$B/api/mcp" "$(curl -s "$B/.well-known/oauth-protected-resource/api/mcp" | field .resource)"
check "discovery: authorization server" "$B/oauth/token" "$(curl -s "$B/.well-known/oauth-authorization-server" | field .token_endpoint)"
check "no token -> 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/mcp" -H 'Content-Type: application/json' -d '{}')"
check "initialize" gtd "$(rpc initialize '{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}' | field .result.serverInfo.name)"
check "tools/list has 11 tools" 11 "$(rpc tools/list '{}' | field .result.tools.length)"
check "gtd_overview returns today's date" "$(TZ=Asia/Jerusalem date +%F)" "$(rpc tools/call '{"name":"gtd_overview","arguments":{}}' | field '.result.content[0].text' | field .today)"
echo; echo "passed=$pass failed=$fail"
