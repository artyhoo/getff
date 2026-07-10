# Overview

The 5-layer framework defines five layers; each MUST be present in every shipped rule.

AST > grep — every check MUST traverse the TSESTree, never raw text.

Paired negative tests MUST accompany every positive case.

Mutation testing (Stryker) MUST kill every introduced mutant.

Two-AI review MUST cross-check before merge.
