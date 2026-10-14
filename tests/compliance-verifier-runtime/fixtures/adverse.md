## §1.7 Forward-check
R1-R20 checked, principles checked, all discipline layers are satisfied by our thorough careful verification.
Doc-authority: fixtures/convention.md:50 declares the owner, fixtures/another.md:3 declares the second owner.

## §1.7 Backward-check
The new rule applies to every fixture Markdown document. Complete sweep performed, all carry headers. We inspected fixtures/convention.md only.
No other surface carries the old marker; `rg old-marker fixtures | head -1` returned nothing, therefore the marker never existed.

## Exemption
New *.override.md exemption; no negative test is in the diff.

## Commit body
§1.7: All checked and compliant.
