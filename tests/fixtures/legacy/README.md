# Legacy baseline fixtures

These are unchanged copies of the static organiser script, profile script,
and profile HTML from before the Next.js migration. Existing tests read or
evaluate them using mocked browser/database objects.

They are test inputs, not application entry points. They are not served by
Next.js and have no production credentials. Baseline tests against these
fixtures do not establish that the React screens behave correctly.
