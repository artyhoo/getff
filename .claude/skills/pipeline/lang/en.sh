#!/usr/bin/env bash
# @cc-only-rationale: NONE — this pack IS shipped (the /pipeline skill ships via setup.d/10-skills.sh:164-169, the env+ skill loop). EN is the canonical default.
# @dual-pair: pipeline-lang-i18n
#
# English emitted-token pack for the /pipeline skill session report.
# Canonical default — used when AIF_HOOK_LANG is unset or names a missing pack.
# Sibling: lang/ru.sh (operator). Key parity enforced by lang/check-parity.sh.
# See docs/superpowers/specs/2026-06-03-pipeline-skill-i18n-design.md.

AIF_PIPELINE_COL_PASTE='Paste into a new CC tab'
AIF_PIPELINE_COL_WHEN='When'
AIF_PIPELINE_COL_WAITING='Waiting on'
AIF_PIPELINE_COL_PARALLEL='Can parallel with'
AIF_PIPELINE_LBL_WHATDOES='What it does'
AIF_PIPELINE_LBL_WHYNOW='Why now'
AIF_PIPELINE_STATUS_CURRENT='current'
AIF_PIPELINE_WAVE_NOW='NOW'
AIF_PIPELINE_ACTION_QUEUE_SUB='what you do next'
AIF_PIPELINE_INFLIGHT_PR_NOTE='(possibly dispatched in another session)'
AIF_PIPELINE_INFLIGHT_UNMERGED='(not merged)'
AIF_RECAP_MARKER='## 🟢 In plain words'
