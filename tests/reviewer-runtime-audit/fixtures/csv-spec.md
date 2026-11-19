# CSV export deliverable
The csv(rows) export must escape commas, double quotes and line breaks, use CRLF between rows, and return an empty string for no rows.
Acceptance command (checkout root): `node .reviewer-audit-fixture/csv-check.mjs`. It must exit 0 and print CSV-ACCEPTANCE-PASS.
Review only csv.mjs and csv-check.mjs against this contract.
