#!/usr/bin/env python3
"""wire-apply-husky-patch.py — one-time operator wiring for the sanctioned .husky patch channel.

The ONE reviewed change: register .claude/hooks/apply-husky-patch-gate.sh in
.ai-factory/harness-model.json (hooks.PreToolUse), re-render .claude/settings.json
hooks via scripts/render-harness-config.mjs --write, and append the --dry-run allow
rule to .claude/settings.json permissions.allow. With --commit it also lands the
wiring commit; without it, the exact commit line is printed.

SEAL NOTICE: .claude/settings.json denies agents Edit/Write and the harness SSOT is
[self-Modification]-guarded — this operator launch IS the explicit override.

op-script contract: ~/.agents/skills/op-script/SKILL.md (--dry-run, timestamped
backups, validation re-read from disk, auto-restore, idempotency, refuse-fast,
--self-test with induced-failure restore).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

TEST_FAIL_KNOB = "OP_SCRIPT_TEST_FAIL_VALIDATION"
GATE_ENTRY_CMD = 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/apply-husky-patch-gate.sh"'
ALLOW_RULE = 'Bash(bash "$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh" --dry-run *)'
COMMIT_MSG = "wiring: apply-husky-patch-gate hook + dry-run allow (sanctioned .husky patch channel)"
MODEL = ".ai-factory/harness-model.json"
SETTINGS = ".claude/settings.json"
GATE_HOOK = ".claude/hooks/apply-husky-patch-gate.sh"
RENDERER = "scripts/render-harness-config.mjs"


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        fail(f"target not found: {path}")
    except json.JSONDecodeError as exc:
        fail(f"{path} is not valid JSON ({exc}) — refusing to touch it")


def run_repo(repo, *cmd, check=True):
    r = subprocess.run(list(cmd), cwd=repo, capture_output=True, text=True)
    if check and r.returncode != 0:
        fail(f"{' '.join(cmd[:2])} failed rc={r.returncode}: {(r.stderr or r.stdout).strip()[:400]}")
    return r


def model_pretooluse(data):
    try:
        return data["hooks"]["PreToolUse"]
    except (KeyError, TypeError):
        fail(f"{MODEL}: hooks.PreToolUse missing or not a list — wrong shape, refusing")


def entry_in(entries):
    return any(e.get("matcher") == "Bash" and e.get("command") == GATE_ENTRY_CMD for e in entries if isinstance(e, dict))


def allow_fingerprint(settings):
    clone = json.loads(json.dumps(settings))
    clone.pop("permissions", None)
    clone.pop("hooks", None)
    return json.dumps(clone, sort_keys=True)


def model_fingerprint(model):
    clone = json.loads(json.dumps(model))
    clone.get("hooks", {}).pop("PreToolUse", None)
    return json.dumps(clone, sort_keys=True)


def pre_change_state(repo):
    for rel in (MODEL, SETTINGS, GATE_HOOK, RENDERER):
        if not os.path.isfile(os.path.join(repo, rel)):
            fail(f"{rel} not found under {repo} — wrong repo, or staging not pulled past #2068; refusing")
    model = load_json(os.path.join(repo, MODEL))
    settings = load_json(os.path.join(repo, SETTINGS))
    node = shutil.which("node")
    if not node:
        fail("node not on PATH — the renderer needs it")
    st = {
        "repo": repo,
        "model": model,
        "settings": settings,
        "allow": list(settings.get("permissions", {}).get("allow", [])),
        "fp_settings": allow_fingerprint(settings),
        "fp_model": model_fingerprint(model),
        "node": node,
    }
    if not check_green(repo, st):
        fail(".claude/settings.json hooks are drifted from the SSOT (--check RED) — "
             "resolve the drift first; wiring would bake it in")
    return st


def check_green(repo, st):
    return subprocess.run(
        [st["node"], RENDERER, "--check"], cwd=repo, capture_output=True
    ).returncode == 0


def already_wired(repo, st):
    """Entry + rule present AND the rendered hooks on disk match the SSOT (--check green)."""
    if not entry_in(model_pretooluse(st["model"])):
        return False
    if ALLOW_RULE not in st["allow"]:
        return False
    return check_green(repo, st)


def plan_lines():
    return [
        f"+ append {{matcher: Bash, command: {GATE_ENTRY_CMD!r}}} to {MODEL} hooks.PreToolUse",
        f"+ node {RENDERER} --write  (rewrites {SETTINGS} hooks: exactly one new PreToolUse Bash group)",
        f"+ append {ALLOW_RULE!r} to {SETTINGS} permissions.allow",
    ]


def apply_change(repo, st, commit):
    bak_model = f"{os.path.join(repo, MODEL)}.bak-{time.strftime('%Y%m%d-%H%M%S')}"
    bak_settings = f"{os.path.join(repo, SETTINGS)}.bak-{time.strftime('%Y%m%d-%H%M%S')}"
    shutil.copy2(os.path.join(repo, MODEL), bak_model)
    shutil.copy2(os.path.join(repo, SETTINGS), bak_settings)

    def restore(reason):
        shutil.copy2(bak_model, os.path.join(repo, MODEL))
        shutil.copy2(bak_settings, os.path.join(repo, SETTINGS))
        if os.environ.get(TEST_FAIL_KNOB) == "1":
            print(f"TEST-INDUCED validation failure — restored from {bak_model} + {bak_settings}")
            sys.exit(2)
        fail(f"{reason} — BOTH files restored from backups")

    model = st["model"]
    model_pretooluse(model).append({"matcher": "Bash", "command": GATE_ENTRY_CMD})
    with open(os.path.join(repo, MODEL), "w", encoding="utf-8") as fh:
        json.dump(model, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    r = run_repo(repo, st["node"], RENDERER, "--write", check=False)
    if r.returncode != 0:
        restore(f"renderer --write failed rc={r.returncode}: {(r.stderr or r.stdout).strip()[:300]}")

    # re-read from disk: the renderer just rewrote the hooks key — never layer the
    # allow-rule edit onto a stale in-memory copy
    settings = load_json(os.path.join(repo, SETTINGS))
    settings.setdefault("permissions", {})["allow"] = st["allow"] + [ALLOW_RULE]
    with open(os.path.join(repo, SETTINGS), "w", encoding="utf-8") as fh:
        json.dump(settings, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    if os.environ.get(TEST_FAIL_KNOB) == "1":
        restore("induced")  # fires after both writes, before read-back validation

    # post-conditions, re-read FROM DISK
    rb_model = load_json(os.path.join(repo, MODEL))
    rb_settings = load_json(os.path.join(repo, SETTINGS))
    if not entry_in(model_pretooluse(rb_model)):
        restore("model entry missing on read-back")
    if model_fingerprint(rb_model) != st["fp_model"]:
        restore("harness-model changed outside hooks.PreToolUse")
    rb_allow = rb_settings.get("permissions", {}).get("allow", [])
    if rb_allow != st["allow"] + [ALLOW_RULE]:
        restore("permissions.allow is not exactly before + the one rule")
    old_pre = st["settings"].get("hooks", {}).get("PreToolUse", [])
    new_pre = rb_settings.get("hooks", {}).get("PreToolUse", [])
    added = [e for e in new_pre if e not in old_pre]
    if len(new_pre) != len(old_pre) + 1 or len(added) != 1 \
            or "apply-husky-patch-gate.sh" not in json.dumps(added[0]):
        restore("renderer did not add exactly one PreToolUse gate group")
    if subprocess.run([st["node"], RENDERER, "--check"], cwd=repo, capture_output=True).returncode != 0:
        restore("render-harness-config --check is RED after the write (drift)")

    print(f"OK: gate wired — model entry + rendered hooks + allow rule verified from disk")
    print(f"NOT touched: permissions.deny, env, claudeMdExcludes, all other repo files; hooks are "
          f"renderer-owned and were drift-verified green before and after (zcode shims may "
          f"regenerate — gitignored operator env)")
    print(f"backups: {bak_model}\n         {bak_settings}")
    print("rollback: cp the two .bak-* files back over their targets")
    if commit:
        run_repo(repo, "git", "add", MODEL, SETTINGS)
        rc = run_repo(repo, "git", "commit", "-m", COMMIT_MSG, check=False).returncode
        if rc != 0:
            print("WARNING: git commit failed — the validated edits stay in the working tree; "
                  "commit manually with the line below")
        else:
            print("OK: wiring commit landed (the approval act)")
            return 0
    print("commit (the approval act):")
    print(f"  cd {repo} && git add {MODEL} {SETTINGS} && git commit -m \"{COMMIT_MSG}\"")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo", default=None,
                    help="repo root containing .ai-factory/harness-model.json "
                         "(default: the repo this script lives in — scripts/..)")
    ap.add_argument("--commit", action="store_true",
                    help="also land the wiring commit (the approval act) after validation")
    ap.add_argument("--dry-run", action="store_true", help="print the planned change, write nothing")
    ap.add_argument("--self-test", action="store_true", help="run the fixture suite")
    args = ap.parse_args()
    if args.self_test:
        sys.exit(selftest())
    repo = os.path.realpath(args.repo or
                            os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if not os.path.isdir(repo):
        fail(f"--repo is not a directory: {repo}")
    st = pre_change_state(repo)
    print("SEAL NOTICE: .claude/settings.json denies agents Edit/Write and the harness SSOT is "
          "self-modification-guarded — your launch of this script is the explicit override.")
    if already_wired(repo, st):
        print("OK: already wired (entry + allow rule present, --check green) — no-op, no backup, no write.")
        return 0
    dirty = run_repo(repo, "git", "status", "--porcelain", "--", MODEL, SETTINGS).stdout.strip()
    if dirty:
        fail(f"{MODEL}/{SETTINGS} carry uncommitted changes while the wiring is NOT complete — "
             f"land or stash them first:\n{dirty}")
    if args.dry_run:
        print(f"DRY-RUN: would change, in {repo}:")
        for line in plan_lines():
            print(f"  {line}")
        print(f"then with --commit: git add {MODEL} {SETTINGS} && git commit")
        print("Everything else stays untouched; timestamped .bak-* copies are created first.")
        return 0
    sys.exit(apply_change(repo, st, args.commit))


# ------------------------------------------------------------ self-test
# Fixture: a mini repo whose renderer is a faithful minimal double (--write derives
# settings hooks from the model; --check exits 0 iff they match). Five case kinds.

FAKE_RENDERER = r"""#!/usr/bin/env node
import fs from 'node:fs';
const model = JSON.parse(fs.readFileSync('.ai-factory/harness-model.json', 'utf8'));
const settingsPath = '.claude/settings.json';
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const hooks = {};
for (const [event, entries] of Object.entries(model.hooks)) {
  hooks[event] = entries.map((e) => ({matcher: e.matcher, hooks: [{type: 'command', command: e.command}]}));
}
if (process.argv[2] === '--write') {
  settings.hooks = hooks;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  process.exit(0);
}
const want = JSON.stringify(hooks), have = JSON.stringify(settings.hooks);
process.exit(want === have ? 0 : 1);
"""


def _write(root, rel, text):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(text)
    return p


_MKSEQ = [0]


def _mkrepo(root):
    _MKSEQ[0] += 1
    repo = os.path.join(root, f"mini-{_MKSEQ[0]}")
    _write(repo, MODEL, json.dumps({"hooks": {
        "PreToolUse": [{"matcher": "Edit|Write|MultiEdit", "command": "bash existing.sh"}],
        "PostToolUse": [{"matcher": "Write", "command": "bash post.sh"}],
    }}, indent=2) + "\n")
    _write(repo, SETTINGS, json.dumps({
        "env": {"A": "1"},
        "permissions": {"allow": ["Bash(existing *)"], "deny": ["Edit(.husky/**)"]},
        "hooks": {
            "PreToolUse": [{"matcher": "Edit|Write|MultiEdit", "hooks": [{"type": "command", "command": "bash existing.sh"}]}],
            "PostToolUse": [{"matcher": "Write", "hooks": [{"type": "command", "command": "bash post.sh"}]}],
        },
        "claudeMdExcludes": ["**/x.md"],
    }, indent=2) + "\n")
    _write(repo, GATE_HOOK, "#!/usr/bin/env bash\nexit 0\n")
    _write(repo, RENDERER, FAKE_RENDERER)
    subprocess.run(["git", "init", "-q", repo], check=True)
    subprocess.run(["git", "-C", repo, "config", "user.email", "t@t"], check=True)
    subprocess.run(["git", "-C", repo, "config", "user.name", "t"], check=True)
    subprocess.run(["git", "-C", repo, "add", "-A"], check=True)
    subprocess.run(["git", "-C", repo, "commit", "-q", "-m", "init"], check=True)
    return repo


def _call(repo, *extra, env_extra=None):
    env = dict(os.environ)
    env.pop(TEST_FAIL_KNOB, None)
    if env_extra:
        env.update(env_extra)
    return subprocess.run(
        [sys.executable, os.path.abspath(__file__), "--repo", repo, *extra],
        capture_output=True, text=True, env=env,
    )


def selftest():
    root = tempfile.mkdtemp(prefix="wire-apply-husky-patch-selftest-")
    results = []

    def check(name, cond, detail=""):
        results.append(bool(cond))
        print(f"{'PASS' if cond else 'FAIL'}  {name}" + (f"  — {detail}" if detail and not cond else ""))

    repo = _mkrepo(root)
    pre_model = open(os.path.join(repo, MODEL)).read()
    pre_settings = open(os.path.join(repo, SETTINGS)).read()

    r = _call(repo, "--dry-run")
    check("0 dry-run writes nothing",
          r.returncode == 0 and open(os.path.join(repo, MODEL)).read() == pre_model
          and open(os.path.join(repo, SETTINGS)).read() == pre_settings, r.stdout + r.stderr)

    r = _call(repo)
    d_settings = json.load(open(os.path.join(repo, SETTINGS)))
    d_model = json.load(open(os.path.join(repo, MODEL)))
    baks = [f for f in os.listdir(os.path.join(repo, ".claude")) if f.startswith("settings.json.bak-")]
    new_pre = d_settings["hooks"]["PreToolUse"]
    check("1 happy path: model entry + rendered hooks + allow appended + others frozen",
          r.returncode == 0
          and entry_in(d_model["hooks"]["PreToolUse"])
          and len(new_pre) == 2 and new_pre[1]["hooks"][0]["command"] == GATE_ENTRY_CMD
          and d_settings["permissions"]["allow"] == ['Bash(existing *)', ALLOW_RULE]
          and d_settings["permissions"]["deny"] == ["Edit(.husky/**)"]
          and d_settings["env"] == {"A": "1"} and d_settings["claudeMdExcludes"] == ["**/x.md"]
          and d_settings["hooks"]["PostToolUse"][0]["hooks"][0]["command"] == "bash post.sh"
          and len(baks) == 1, r.stdout + r.stderr)

    r2 = _call(repo)
    baks2 = [f for f in os.listdir(os.path.join(repo, ".claude")) if f.startswith("settings.json.bak-")]
    check("2 idempotent re-run: no-op, no new backup",
          r2.returncode == 0 and "no-op" in r2.stdout and len(baks2) == 1, r2.stdout + r2.stderr)

    bad = _mkrepo(root)
    with open(os.path.join(bad, SETTINGS), "w") as fh:
        fh.write("{oops")
    pre_bad = open(os.path.join(bad, SETTINGS)).read()
    r3 = _call(bad)
    check("3 malformed settings: refused, bytes unchanged",
          r3.returncode != 0 and open(os.path.join(bad, SETTINGS)).read() == pre_bad, r3.stdout + r3.stderr)

    wrong = _mkrepo(root)
    with open(os.path.join(wrong, MODEL), "w") as fh:
        fh.write(json.dumps({"hooks": {"PreToolUse": "not-a-list"}}))
    pre_wrong = open(os.path.join(wrong, MODEL)).read()
    r4 = _call(wrong)
    check("4 wrong shape: refused, bytes unchanged",
          r4.returncode != 0 and open(os.path.join(wrong, MODEL)).read() == pre_wrong, r4.stdout + r4.stderr)

    ind = _mkrepo(root)
    r5 = _call(ind, env_extra={TEST_FAIL_KNOB: "1"})
    restored = open(os.path.join(ind, MODEL)).read()
    rb_settings = open(os.path.join(ind, SETTINGS)).read()
    # pre_change_state refused nothing; the knob fires at validation → both files restored
    pre_m = json.loads(pre_model)
    check("5 induced failure: rc=2 + both files restored to pre-state",
          r5.returncode == 2 and "restored" in r5.stdout
          and json.loads(restored)["hooks"]["PreToolUse"][0]["matcher"] == "Edit|Write|MultiEdit"
          and "apply-husky-patch-gate" not in restored
          and "apply-husky-patch-gate" not in rb_settings, r5.stdout + r5.stderr)

    dirty = _mkrepo(root)
    with open(os.path.join(dirty, SETTINGS), "a") as fh:
        fh.write("\n")
    r6 = _call(dirty, "--dry-run")
    check("6 dirty worktree on targets: refuse-fast",
          r6.returncode != 0 and "uncommitted" in r6.stderr, r6.stdout + r6.stderr)

    n_bad = len([ok for ok in results if not ok])
    print(f"\nself-test: {len(results) - n_bad}/{len(results)} passed" +
          (f"; FAILED {n_bad}" if n_bad else ""))
    return 1 if n_bad else 0


if __name__ == "__main__":
    main()
