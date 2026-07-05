# demo/violation-blocked.tape — regenerate: `make demo` (runs demo/setup-sandbox.sh first)
# Shows a real `git commit` blocked by the shipped pre-commit hook the moment
# an `as any` cast lands in the diff — before CI ever sees it.

Output demo/violation-blocked.gif

Set Shell "bash"
Set FontSize 16
Set Width 1200
Set Height 600
Set Theme "Dracula"

Type "cd /tmp/getff-demo && cat src/index.ts"
Enter
Sleep 1s

Type "cat >> src/index.ts <<'TS'"
Enter
Type ""
Enter
Type "export function unsafeCast(data: unknown) {"
Enter
Type "  return (data as any).value;"
Enter
Type "}"
Enter
Type "TS"
Enter
Sleep 1s

Type "git add -A && git commit -m 'feat: add unsafe cast'"
Enter
Sleep 3s
