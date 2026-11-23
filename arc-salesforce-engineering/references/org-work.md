# Org work

Read at step 8, before the first deploy, and again at step 9 for production. `sf` is the pinned CLI from SKILL.md's Pins.

## Signing in

- `sf org login web --alias <alias>` (add `--instance-url https://test.salesforce.com` for a sandbox) opens a browser. In a session with no browser, ask the user to run it and say which alias to use; never ask for a password or token in chat.
- Server-to-server sign-in for CI is a JWT bearer flow: `arc-sf-jwt-bearer`.
- `sf org display --target-org <alias> --json` shows the instance and API version.

## Scratch orgs

- They need a Dev Hub (`sf org login web --set-default-dev-hub --alias devhub`). Without one, use a sandbox or a Developer Edition org, and say so.
- `sf org create scratch --definition-file config/project-scratch-def.json --alias <alias> --duration-days 7 --set-default`. Add a feature to the definition file only when the change needs it.
- `sf org delete scratch --target-org <alias>` when done. Scratch orgs count against a daily limit.

## Deploying to a scratch org or sandbox

- **Deploy only what you changed** in a shared sandbox: `sf project deploy start --source-dir <changed paths> --target-org <alias>` (or `--metadata <Type:Name>`). Deploying all of `force-app` there can overwrite other people's work. In your own scratch org, `--source-dir force-app` is fine. Scratch orgs track changes, so `sf project deploy preview` and `sf project retrieve preview` show what differs.
- `sf org assign permset --name <PermSet> --target-org <alias>` for yourself. For a test user without admin rights, `sf org create user` in a scratch org, then assign the permission set to that user.
- **Run your tests.** In a shared sandbox: `sf apex run test --class-names <YourTest> --class-names <OtherTest> --code-coverage --result-format human --wait 20 --target-org <alias>`. Other teams' failing tests are not yours to fix, but say if you saw them. In your own scratch org, `npm run org:test -- --target-org <alias>` runs every local test. Read coverage per class from the output, not only the org-wide total.

## Lightning pages

- A Lightning page is a FlexiPage. List them: `sf org list metadata --metadata-type FlexiPage --target-org <alias>`. Retrieve the one you will change before you open App Builder (step 3 applies).
- An object that still uses the default record page has no FlexiPage of its own yet. In App Builder, edit the record page to create one; App Builder saves it as a new FlexiPage.
- Add the component in App Builder (`sf org open --target-org <alias> --path lightning/setup/FlexiPageList/home`), then **activate** the page: as the org default, or for an app, record type and profile. Activation is stored on the app or the object (its `actionOverrides`), not on the FlexiPage, so retrieve both if the page must ship active.
- Retrieve the page afterwards (`--metadata FlexiPage:<Name>`) and commit it. A page built only in the sandbox is lost at its next refresh.

## Data

- Test data comes from Apex tests or a plan file (`sf data import tree --plan data/plan.json`), never from production.
- Never run `sf data delete` or anonymous Apex that writes against production. In a sandbox, say what it deletes before running it.

## Production

1. **Confirm** that the user wants a production deploy, naming the org alias and the components.
2. **Back up**: the retrieved source from step 3 is the rollback for changed components. For new components, the rollback is a deletion, so list them.
3. **Validate**: `npm run org:validate -- --target-org <prod>` validates all of `force-app`. In a project other people also deploy from, validate only your paths: `sf project deploy validate --source-dir <changed paths> --test-level RunLocalTests --target-org <prod>`. It runs every local test and deploys nothing. Note the job ID.
4. **Quick-deploy** the validated job: `sf project deploy quick --job-id <id> --target-org <prod>`. This works within 10 days of validation, provided nothing has been deployed in between.
5. **Report** the deploy ID, the test counts and the coverage.

Deletions go in a destructive manifest (`sf project deploy start --manifest package.xml --post-destructive-changes destructiveChanges.xml`). List every component in the reply and get a separate yes for it: deleting a field deletes its data.

## Packaging

Unlocked or second-generation managed packages (`sf package create`, `sf package version create`) are a separate decision. Use them only when the user asks for a package or the project already has one in `sfdx-project.json`; otherwise deploy source.
