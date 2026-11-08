#!/usr/bin/env bash
# Observe staging through ordinary readable metadata. Registration remains an owner action.
# Exit 0: concrete classic witness covers all wanted contexts; 1: known missing; 2: unverified.
set -euo pipefail

unverified() {
  echo "::error::UNVERIFIED: $*" >&2
  exit 2
}

wanted=${1-}
repo=${GH_REPO-}
[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || unverified 'GH_REPO must be owner/repository'
if ! jq -es 'length == 1 and (.[0] | type == "array" and length > 0 and all(.[]; type == "string" and length > 0))' <<< "$wanted" >/dev/null 2>&1; then
  unverified 'expected a nonempty required_contexts JSON string array'
fi
source="repos/$repo/branches/staging"
# Capture transport status independently of the body: a valid body on failure proves nothing.
if branch_json=$(gh api "$source"); then
  :
else
  api_status=$?
  unverified "$source API exit $api_status"
fi
if ! jq -es '
  def strings: type == "array" and all(.[]; type == "string" and length > 0);
  def checks: type == "array" and all(.[]; type == "object" and (.context | type == "string" and length > 0));
  length == 1 and (.[0] |
    type == "object" and .name == "staging" and
    (if .protected == false then
       (.protection == null or (.protection | type == "object" and .enabled == false and .required_status_checks == null))
     elif .protected == true then
       (.protection | type == "object" and .enabled == true and has("required_status_checks") and
         (.required_status_checks | . == null or
           (type == "object" and (has("contexts") or has("checks")) and
             ((has("contexts") | not) or (.contexts | strings)) and
             ((has("checks") | not) or (.checks | checks)))))
     else false end))
' <<< "$branch_json" >/dev/null 2>&1; then
  unverified "$source invalid JSON or unsupported branch schema"
fi
missing=$(jq -crs --argjson want "$wanted" '
  .[0] | $want - ((.protection.required_status_checks.contexts // []) +
    [(.protection.required_status_checks.checks // [])[] | .context])
' <<< "$branch_json")
if [[ "$missing" == '[]' ]]; then
  echo "READABLE COMPLETE: all declared required contexts present; source GET $source (classic metadata)"
  exit 0
fi

# Missing classic contexts are conclusive only when no active/ambiguous ruleset could supply them.
# Include inherited rulesets and every page; no general ruleset applicability engine is claimed.
rules_source="repos/$repo/rulesets?includes_parents=true&per_page=100"
if rulesets_json=$(gh api --paginate "$rules_source"); then
  :
else
  api_status=$?
  unverified "$rules_source API exit $api_status; classic missing $missing"
fi
if ! jq -es 'length > 0 and all(.[];
  type == "array" and all(.[];
    type == "object" and (.enforcement == "disabled" or .enforcement == "evaluate")))
' <<< "$rulesets_json" >/dev/null 2>&1; then
  unverified "$rules_source invalid/unknown schema or active uninspected ruleset; classic missing $missing"
fi

echo "::error::READABLE MISSING: source GET $source plus GET $rules_source (empty/inactive rulesets); missing required contexts: $missing"
echo "::error::Settings → Branches → staging → Require status checks → add: $missing (preserve existing policy)"
exit 1
