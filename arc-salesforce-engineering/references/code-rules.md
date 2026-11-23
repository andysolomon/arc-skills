# Code rules

Read at step 5, before writing Apex, a trigger, a Flow or a component.

## Apex

- **Runs as the user.** Classes are `with sharing`. Queries use `WITH USER_MODE`, and DML uses `insert as user` / `Database.insert(records, AccessLevel.USER_MODE)`, so object and field access apply. `without sharing` needs a written reason in a comment and a test that shows why.
- **Bulk-safe.** No SOQL or DML inside a loop. Collect IDs, query once into a `Map<Id, SObject>`, write once. Assume every trigger fires with 200 records.
- **One boundary per entry point.** Every `@AuraEnabled` method catches what it can name (`QueryException` for missing access, `DmlException` for validation failures) and then `Exception`, logs the cause with `System.debug(LoggingLevel.ERROR, …)`, and throws an `AuraHandledException` whose message is a sentence a user can act on. Anything that escapes reaches the user as "An internal server error has occurred". See `AccountListController` in the template.
- **Reads are `cacheable=true`**, so `@wire` keeps the last good result and `refreshApex` can ask again. Writes are never cacheable and are called imperatively.
- **Seams for tests.** Put queries behind a `virtual` selector class and hold it in a `@TestVisible private static` field, so a test can swap in a subclass that throws. Don't add a framework for this.
- **Bounded input.** Clamp sizes and limits server-side; never trust a number from the client.
- **No hard-coded IDs, URLs or secrets.** Look records up by developer name; reach outside services through Named Credentials.

## Triggers

- One trigger per object, with no logic in it: it calls a handler class.
- The handler checks what changed (`Trigger.oldMap`) before it does work, so an unrelated edit costs nothing and a recursive update stops.
- Don't mix a record-triggered Flow and an Apex trigger on the same object and event. If both exist, say so and ask which one owns the logic.

## Flows

- A Flow is metadata in `force-app/main/default/flows`. Build it in Flow Builder in a scratch org or sandbox, then retrieve it (`--metadata Flow:<Name>`). Never hand-write Flow XML.
- Name every element after what it decides or does. Every fault path ends in a screen or an email that says what happened; no fault path is left empty.
- Deploy a new Flow version as active only when the request says so.

## Apex tests

- One test class per class, `@IsTest private`. `@TestSetup` makes the data; tests never rely on org data (`SeeAllData` stays off).
- Assert results with `Assert.areEqual` / `Assert.isTrue` and a message. A test without an assertion doesn't count toward the 85% goal, even if the platform counts its coverage.
- Cover the bulk path (200 records), the failure path through the selector seam, and the access path: `System.runAs` a user with only the permission set, when the org has a profile you can name for that user.
- `Test.startTest()` / `Test.stopTest()` around the call under test, so limits reset and async work runs.

## Components (LWC)

- **States first.** Loading, empty, failure and stale each render something specific (the arc-design taste rules). With `@wire`, keep the last good data in a field: when a refresh fails, the wire hands you only an error, and the field is what keeps the list on screen. See `accountList`.
- **Text.** Error text comes from the Apex sentence (`error.body.message`) or a fallback the component owns, for an error with no message (offline, a timeout). Never show `error.body.stackTrace` or an exception type.
- **Unknown is written as unknown.** A missing field value shows as "Industry not set", not a blank or a guess.
- **Lists** use `for:each` with `key` set to the record ID.
- **Record pages.** A component that shows data about the page's record declares `@api recordId` and passes it reactively: `@wire(getOpenCases, { accountId: '$recordId' })`. The wire waits until `recordId` is set. In `js-meta.xml`, list `lightning__RecordPage` with a `targetConfigs` entry whose `<objects>` names the objects it fits (`<object>Account</object>`), so App Builder offers it only there. In Jest, set `element.recordId = '001...'` before appending the element, and assert the wire's config (`getLastConfig()`). Apex still checks access: a record ID from the client proves nothing about what the user may see. The template's `accountList` is not record-bound, so it targets App and Home pages only.
- **Navigation.** On Lightning pages, `/lightning/r/<Object>/<Id>/view` links work. On an Experience Cloud site, use `NavigationMixin` instead.
- **Labels.** User-facing text that a non-English org would translate goes in Custom Labels (`@salesforce/label/c.Name`). The template uses literals to stay small; say so when you keep them.
- **No DOM reach-through.** Don't query into a child component's shadow tree or style a base component's internals. Style the host element or use the base component's attributes.

## Jest

- Mock each Apex import with `createApexTestWireAdapter` (for `@wire`) or a `jest.fn()` (for imperative calls), with `{ virtual: true }`.
- Find controls by label: `lightning-button` elements by their `label` property, our own elements by role.
- `await` a flushed promise after every `emit` or `error` before you assert.
- The Jest resolver doesn't find CSS-only modules, so `jest.config.js` maps `c/arcTokens` to its file. Keep that mapping when you change the config.

## Pitfalls

- A `:root` rule in a component stylesheet matches nothing, because component styles are scoped to the component. Tokens are declared on `:host`, which is why `arcTokens` is generated rather than copied.
- A failed `@wire` refresh delivers `{ data: undefined, error }`. A component that reads only `data` goes blank instead of stale.
- `AuraHandledException` loses its message in tests unless you also call `setMessage(message)`; the template's `newHandled` does both.
- `.forceignore` keeps `__tests__` and `jsconfig.json` out of deploys. A new kind of local-only file goes there too.
