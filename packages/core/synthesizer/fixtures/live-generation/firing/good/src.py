# CLEAN fixture: uses the safe replacement yaml.safe_load — `ast-grep scan` must exit 0 and
# report ZERO findings (AC3). Mirrors the record's examples.good.
import yaml

data = yaml.safe_load(raw)
