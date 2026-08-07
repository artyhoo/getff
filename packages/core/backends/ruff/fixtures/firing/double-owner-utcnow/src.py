# T-DTZ-A counter fixture (kickoff §3, T-HS-A binding). A single `datetime.datetime.utcnow()`
# call MUST fire exactly ONE diagnostic — our TID251 — and NO DTZ003 (the family sibling that
# would double-report if `select = ["DTZ"]` were used). T-HS-A: assert the count first.
import datetime


def main():
    return datetime.datetime.utcnow()
