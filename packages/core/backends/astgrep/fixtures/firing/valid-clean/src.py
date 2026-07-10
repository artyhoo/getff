# A genuinely-conforming module: it never calls datetime.datetime.now, carries no
# suppression comment, and produces ZERO findings — proving the rendered rule is
# no-false-positive on code that simply does not violate the convention.
def main(clock):
    return clock.now()
