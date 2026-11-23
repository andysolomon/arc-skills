# Foldkit rules

Read this before writing a Model. Each rule has the file in `template/` that shows it.

## File shape

| File | Holds |
|---|---|
| `src/model.ts` | Model and Messages as Effect Schemas. No runtime, no DOM. |
| `src/commands.ts` | Every side effect, as `Command.define(...)` values. |
| `src/main.ts` | `update`, `init`, `subscriptions`, `view`. Definitions only. |
| `src/entry.ts` | Boots the Runtime. The only file that touches `document`. |
| `test/app.test.ts` | Story and Scene tests. Run with `node`, no browser. |

Keep that split. Everything except `entry.ts` must import cleanly in Node, or the tests and the static render stop working.

## Model and Messages (`src/model.ts`)

- **One Model, one Schema.** No state lives in the view or in module variables.
- **A remote value is an `AsyncData`**, never a nullable plus a loading flag. Its Refreshing and Stale cases keep the last good data on screen.
- **A write the user starts gets a phase union** (`defineTaggedUnion`): for example Saving, Saved, Failed. The view matches on it.
- **The idempotency key lives in the Model.** Mint it before the user can submit, keep it with the pending item, and reuse it on every retry. The server uses the same key to dedupe. This is what makes a double-click or a lost reply harmless.
- **Messages are past-tense facts** (`ChangedDraft`, `SubmittedNote`, `SucceededSaveNote`, `FailedSaveNote`), made with `defineMessageUnion`. Name who caused them: the user, a Command, or a Subscription.

## `update` (`src/main.ts`)

- **Pure.** No clock, no randomness, no fetch, no `window`. Each of those is a Command. This keeps the Model replayable from its Message log.
- **Type it with its requirements**: `Update.Return<Model, Message, HttpClient.HttpClient>` when Commands need an HTTP client. Provide the client once, through `resources` in `entry.ts`.
- **Guard every transition.** A reply for an item that is no longer in the phase it was sent from is ignored. A submit with no key, or with an empty draft, returns the Model unchanged.
- **Don't stack requests.** `AsyncData.revalidateOrLoad` returns `None` while a load is in flight; send nothing then.
- **Change fields with `modifyFields`** from `foldkit/struct`.

## Commands (`src/commands.ts`)

- **`Command.define(name, { args?, messages, execute })`.** `execute` is an Effect that ends in one of the declared Messages.
- **The error channel is `never`.** End every `execute` with `Effect.catch` that returns a `Failed…` Message. The compiler then proves no failure is dropped.
- **Decode every response** with a Schema (`HttpClientResponse.schemaBodyJson`). Server data is untrusted.
- **Retry a write only when its body carries the key.** `HttpClient.retryTransient` re-sends the same body on transient failures such as a network error or a 5xx.
- **Use relative URLs.** The app talks to whatever served it, so there is no CORS and no base-URL setting.

## `view` (`src/main.ts`)

- **Pure**, built with the `h` builder (`HtmlBuilder<Message>`). Handlers are Messages (`h.OnClick(Message.ClickedRetry({ … }))`), not callbacks.
- **Match every state.** `AsyncData.matchData` for data, the phase union's `match` for writes. No state falls through to a blank screen.
- **Label everything.** An `h.label` with `h.For`, or `h.AriaLabel`. Scene finds controls by role and label, so a missing label fails the test.
- **Key lists by a Model identity** with `h.keyed("li")(id, …)`. A row then keeps its DOM node while its state changes, which is also what lets a CSS state-change animation play once.
- **Put the state in a class** (`item is-pending saved`). CSS hangs colour and motion on it; the view never sets inline styles for state.
- **Screen text is plain.** Keep the technical cause in the Message for tests and DevTools; show a sentence the user can act on.

## Subscriptions (`src/main.ts`)

- **`Subscription.make<Model, Message>()`** maps the Model to streams of Messages. `Subscription.persistentEntry` runs for the app's whole life. An `entry` with dependencies restarts whenever those dependencies change, and stops when its stream is empty.
- **Polling is a tick Message**, and `update` decides whether a request is due.

## Tests (`test/app.test.ts`)

- **Story** drives `update`: `Story.given(model)`, `Story.message(…)`, `Story.Command.expectExact(…)`, `Story.Command.resolve(Definition, ResultMessage)`, `Story.model((m) => …)`, `Story.Command.expectNone()`.
- **Scene** drives `view`: `Scene.role("button", { name })`, `Scene.label("…")`, `Scene.text("…")`, `Scene.type`, `Scene.click`, `Scene.expect(…).toHaveText / toBeDisabled / toExist`, `Scene.Command.resolveAll([Definition, Message], …)`, `Scene.Subscription.emit(Message)`.
- **Story does not run `init`.** Assert `init().commands` directly, and start stories from a Model you build.
- **Both refuse a new Message while a Command is unresolved.** That is the point: no side effect goes unaccounted for. So test "two requests in flight" by calling `update` twice yourself.
- **Wait on conditions, not durations**, in anything that involves a timer.

## Static render (`scripts/render-static.ts`)

- `Server.renderToString(app, { flags, isHydratable: false })` from `foldkit/experimental` returns `{ title, html }` with no hydration stamps and no script. Wrap it in a document with one inline `<style>`.
- A static page has nothing to click, so its Message type is `never`, and it has no `<form>`. Write a separate small view over the same Schemas; don't reuse the app's view.
- With hydration (not used in the template), `renderToString` needs a `buildId`, and the view must be pure or the browser's render won't match.

## Version notes

- **Effect v4.** `Effect.catch` (not `catchAll`); HTTP lives in `effect/http`. When an API you remember is missing, look in `node_modules/effect/ai-docs`, don't guess.
- **Foldkit 0.171 is a beta.** Pin it exactly, and keep `effect` inside its peer range.
- **Erasable TypeScript only** (`erasableSyntaxOnly`): no `enum`, no `namespace`, no parameter properties. Node runs the `.ts` files directly, and it can only strip types.
