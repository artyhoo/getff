# RED fixture: calls the banned yaml.load — `ast-grep scan` must exit 1 and report
# ruleId getff-researched-no-yaml-load (AC3). Mirrors the record's examples.bad.
import yaml

data = yaml.load(raw)
