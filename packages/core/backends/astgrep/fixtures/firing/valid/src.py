import datetime


# Injected-clock accessor: the one sanctioned call site, explicitly suppressed via the
# ast-grep escape hatch so the rule stays satisfiable without deleting the wrapper.
def clock_now():
    return datetime.datetime.now()  # ast-grep-ignore: no-datetime-now


def main():
    return clock_now()
