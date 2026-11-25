# When the user must choose

Read this when the page puts a choice to the user. The page can't take an answer: a card, button, or CSS radio on it never reaches you. So the page explains the choice and the harness's own question dialog collects it (`AskUserQuestion` in Claude Code, which T3 Code shows as tappable options).

- **On the page:** the `decisions` block is the record: numbered questions, lettered options. Give each option its trade-off, put the recommended option first as A, and say why. It must still read on its own on Postplan, where there's no dialog. A `toggle` may show what each option does to the numbers, labelled as a view ("Show option B's numbers"), never as the pick itself.
- **Then ask:** after the page is rendered and the short reply is written, make the dialog your last call. Ask the same questions with the same option names as the page's bold names, the recommended one first with "(Recommended)" at the end of its label. Write each question so it stands alone: the dialog may cover the page. Don't add an "Other" option; the dialog adds one for typed answers.
- **Act on the answer** in the same turn. Don't stop to repeat the choices back. When nothing follows from the answer, mark the chosen option on the page (class `chosen` on its `<li>`, and `CHOSEN` in its `.rec` label), lint it, publish it again, and stop.
- **Limits:** at most 4 questions with 2 to 4 options each. With more, ask the ones that block the next step and leave the rest on the page.
- **No dialog tool** (another harness): end the reply with "Answer like 1A, 2B." Don't ask the user to type codes when the dialog exists.
- **A choice for several people** (a vote, a team pick) needs shared state, so it is an app: see [lakebed.md](lakebed.md).
