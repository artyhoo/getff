import sys
print("controlled probe failure", file=sys.stderr)
raise SystemExit(7)
