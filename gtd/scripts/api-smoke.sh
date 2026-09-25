#!/bin/bash
# End-to-end CRUD check against a running instance. Creates and then deletes its own test rows.
# Usage: scripts/api-smoke.sh http://localhost:3000 "$API_TOKEN"
B=${1:?usage: api-smoke.sh BASE_URL TOKEN}; T=${2:?usage: api-smoke.sh BASE_URL TOKEN}; BODY=$(mktemp); trap "rm -f $BODY" EXIT; A="Authorization: Bearer $T"; J="Content-Type: application/json"
pass=0; fail=0
check() { # name expected actual
  if [ "$2" == "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1 (expected $2, got $3)"; fi; }
req() { curl -s -o $BODY -w '%{http_code}' "$@"; }
jqr() { BODY=$BODY node -e 'let s=require("fs").readFileSync(process.env.BODY,"utf8");let o=JSON.parse(s);console.log(eval("o"+process.argv[1]))' "$1"; }

echo "auth"
check "no token -> 401" 401 $(req $B/api/tasks)
check "wrong token -> 401" 401 $(req -H "Authorization: Bearer nope" $B/api/tasks)

echo "projects"
check "create project -> 201" 201 $(req -X POST -H "$A" -H "$J" -d '{"name":"שיפוץ מטבח","outcome":"מטבח מתפקד עם ארונות חדשים"}' $B/api/projects)
P=$(jqr .id); check "project default status" active $(jqr .status)
check "create project without name -> 400" 400 $(req -X POST -H "$A" -H "$J" -d '{"outcome":"x"}' $B/api/projects)
check "bad project status -> 400" 400 $(req -X POST -H "$A" -H "$J" -d '{"name":"x","status":"paused"}' $B/api/projects)
check "get project" 200 $(req -H "$A" $B/api/projects/$P)
check "patch project -> someday" 200 $(req -X PATCH -H "$A" -H "$J" -d '{"status":"someday"}' $B/api/projects/$P)
check "patched status" someday $(jqr .status)
check "list projects ?status=someday" true $(req -H "$A" "$B/api/projects?status=someday" >/dev/null; jqr ".some(p => p.id === '$P')")

echo "tasks"
check "create inbox task -> 201" 201 $(req -X POST -H "$A" -H "$J" -d '{"title":"לחשוב על חופשה"}' $B/api/tasks)
T1=$(jqr .id); check "default status inbox" inbox $(jqr .status)
check "create full task -> 201" 201 $(req -X POST -H "$A" -H "$J" -d "{\"title\":\"להתקשר לנגר\",\"projectId\":\"$P\",\"status\":\"next\",\"context\":\"@phone\",\"dueDate\":\"2026-10-01\",\"notes\":\"לשאול על מחיר\"}" $B/api/tasks)
T2=$(jqr .id); check "context saved" @phone $(jqr .context); check "dueDate saved" 2026-10-01 $(jqr .dueDate)
check "empty title -> 400" 400 $(req -X POST -H "$A" -H "$J" -d '{"title":"  "}' $B/api/tasks)
check "bad context -> 400" 400 $(req -X POST -H "$A" -H "$J" -d '{"title":"x","context":"@office"}' $B/api/tasks)
check "bad date -> 400" 400 $(req -X POST -H "$A" -H "$J" -d '{"title":"x","dueDate":"2026-02-30"}' $B/api/tasks)
check "unknown field -> 400" 400 $(req -X POST -H "$A" -H "$J" -d '{"title":"x","priority":1}' $B/api/tasks)
check "missing project -> 400" 400 $(req -X POST -H "$A" -H "$J" -d '{"title":"x","projectId":"00000000-0000-4000-8000-000000000000"}' $B/api/tasks)
check "invalid JSON -> 400" 400 $(req -X POST -H "$A" -H "$J" -d '{nope' $B/api/tasks)
check "list all includes new task" true $(req -H "$A" $B/api/tasks >/dev/null; jqr ".some(t => t.id === '$T1')")
check "filter status=next" 1 $(req -H "$A" "$B/api/tasks?status=next&projectId=$P" >/dev/null; jqr .length)
check "filter context=@phone" 1 $(req -H "$A" "$B/api/tasks?context=%40phone&projectId=$P" >/dev/null; jqr .length)
check "filter projectId" 1 $(req -H "$A" "$B/api/tasks?projectId=$P" >/dev/null; jqr .length)
check "bad filter -> 400" 400 $(req -H "$A" "$B/api/tasks?status=later")
check "get task" 200 $(req -H "$A" $B/api/tasks/$T1)
check "get malformed id -> 404" 404 $(req -H "$A" $B/api/tasks/not-a-uuid)
check "get missing id -> 404" 404 $(req -H "$A" $B/api/tasks/00000000-0000-4000-8000-000000000000)
check "mark done" 200 $(req -X PATCH -H "$A" -H "$J" -d '{"status":"done"}' $B/api/tasks/$T1)
check "status is done" done $(jqr .status)
check "clear context -> null" 200 $(req -X PATCH -H "$A" -H "$J" -d '{"context":null}' $B/api/tasks/$T2)
check "context cleared" null $(jqr .context)
check "empty patch -> 400" 400 $(req -X PATCH -H "$A" -H "$J" -d '{}' $B/api/tasks/$T2)
check "patch missing -> 404" 404 $(req -X PATCH -H "$A" -H "$J" -d '{"title":"x"}' $B/api/tasks/00000000-0000-4000-8000-000000000000)

echo "deletes"
check "delete project" 200 $(req -X DELETE -H "$A" $B/api/projects/$P)
check "task survives, projectId null" null $(req -H "$A" $B/api/tasks/$T2 >/dev/null; jqr .projectId)
check "delete task" 200 $(req -X DELETE -H "$A" $B/api/tasks/$T1)
check "deleted task -> 404" 404 $(req -H "$A" $B/api/tasks/$T1)
check "delete task 2" 200 $(req -X DELETE -H "$A" $B/api/tasks/$T2)

echo; echo "passed=$pass failed=$fail"
