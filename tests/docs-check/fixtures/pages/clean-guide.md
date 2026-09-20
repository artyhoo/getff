---
title: Fixture guide, bootstrap clean
description: A guide fixture with no seeded defects; the checker must report zero errors.
kind: guide
sources:
  - docs/site/learn-tutorial-defects.md
---

# Fixture guide, bootstrap clean

This page is written to pass every gate. It links to a real sibling page so the
anchor rule and the link rule both have something true to check.

## Prerequisites

The getff framework is installed and a shell is open.

## Steps

1. Run the setup command and read the printed summary.

   ```sh
   echo setup
   ```

2. Compare the summary with the sibling tutorial page [right here](./learn-tutorial-defects.md).

## Verify

Run the same command again; the summary must match line for line.

## Variations

On a quiet terminal, the same steps print less. The steps themselves do not change.
