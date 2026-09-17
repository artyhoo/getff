---
title: Fixture guide with seeded defects
description: A guide fixture carrying one of each seeded defect class.
kind: guide
---

# Fixture guide with seeded defects

This page exists to be measured. Each seeded defect is one error class, and the
checker must report exactly these and no other error.

## Prerequisites

You need the getff framework installed and a working shell.

<!-- vale off -->
This block is suppressed from Vale on purpose.
<!-- vale on -->

## Steps

1. Run the setup command and watch the printed summary.
2. Open the page that does not exist [right here](./no-such-page.md) and note the failure.

The old name artefact appears once so the name rule can catch it, and the word
zorblify appears once so the spelling rule can catch it.

## Variations

For a quieter run, pass the flag that skips the summary.
