/**
 * A Foldkit program: The Elm Architecture on Effect. Definitions only; nothing runs here.
 *
 *   model.ts     Model + Messages (Schemas)
 *   commands.ts  side effects as values
 *   main.ts      update + init + subscriptions + view   <- this file
 *   entry.ts     boots the browser Runtime (the only file that touches `document`)
 */
import { Duration, Option, Result, Stream } from "effect"
import type { HttpClient } from "effect/http"
import { AsyncData, Subscription, type Update } from "foldkit"
import type { Document, Html, HtmlBuilder } from "foldkit/html"
import { modifyFields } from "foldkit/struct"
import { FetchNotes, MintRequestId, SaveNote } from "./commands.ts"
import { Message, type Model, type Note, type Pending, Phase } from "./model.ts"

export { Model } from "./model.ts"

type Return = Update.Return<Model, Message, HttpClient.HttpClient>

export const REFRESH_EVERY = Duration.seconds(5)

// UPDATE ---------------------------------------------------------------------
// Pure. The only place state changes. No clocks, no randomness, no fetch.

const setPending = (model: Model, requestId: string, f: (p: Pending) => Pending): Model =>
  modifyFields(model, { pending: (ps) => ps.map((p) => (p.requestId === requestId ? f(p) : p)) })

/** Start a list load unless one is already in flight. */
const refresh = (model: Model): Return =>
  Option.match(AsyncData.revalidateOrLoad(model.notes), {
    onNone: () => ({ model }),
    onSome: (notes) => ({ model: modifyFields(model, { notes: () => notes }), commands: [FetchNotes()] })
  })

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    ChangedDraft: ({ text }) => ({ model: modifyFields(model, { draft: () => text }) }),

    SubmittedNote: () => {
      const text = model.draft.trim()
      if (text === "" || Option.isNone(model.draftRequestId)) return { model } // a double-submit lands here
      const requestId = model.draftRequestId.value
      const pending: Pending = { requestId, text, phase: Phase.Saving() }
      return {
        model: modifyFields(model, { pending: (ps) => [pending, ...ps], draft: () => "", draftRequestId: () => Option.none() }),
        commands: [SaveNote({ requestId, text }), MintRequestId()] // and a fresh key for the NEXT draft
      }
    },

    ClickedRetry: ({ requestId }) => {
      const pending = model.pending.find((p) => p.requestId === requestId)
      if (pending === undefined || pending.phase._tag !== "Failed") return { model }
      // Same requestId as the first attempt: if that attempt landed, the server keeps one note.
      return {
        model: setPending(model, requestId, (p) => ({ ...p, phase: Phase.Saving() })),
        commands: [SaveNote({ requestId, text: pending.text })]
      }
    },

    MintedRequestId: ({ requestId }) => ({ model: modifyFields(model, { draftRequestId: () => Option.some(requestId) }) }),

    // The row shows "saved" until the next list load includes the note, then it becomes an ordinary row.
    SucceededSaveNote: ({ requestId }) => ({
      model: setPending(model, requestId, (p) => (p.phase._tag === "Saving" ? { ...p, phase: Phase.Saved() } : p))
    }),

    FailedSaveNote: ({ requestId, error }) => ({
      model: setPending(model, requestId, (p) => (p.phase._tag === "Saving" ? { ...p, phase: Phase.Failed({ error }) } : p))
    }),

    TickedRefresh: () => refresh(model),

    SucceededFetchNotes: ({ notes }) => ({
      model: modifyFields(model, {
        notes: (current) => AsyncData.settle(current, Result.succeed<ReadonlyArray<Note>>(notes)),
        // A saved note leaves the pending list once the loaded list shows it.
        pending: (ps) => ps.filter((p) => !(p.phase._tag === "Saved" && notes.some((n) => n.id === p.requestId)))
      })
    }),

    // Keep the last good list on screen (Stale) instead of blanking it.
    FailedFetchNotes: ({ error }) => ({ model: modifyFields(model, { notes: (current) => AsyncData.settle(current, Result.fail(error)) }) })
  })

// INIT -----------------------------------------------------------------------

export const emptyModel: Model = { notes: AsyncData.Loading(), draft: "", draftRequestId: Option.none(), pending: [] }

export const init = (): Return => ({ model: emptyModel, commands: [MintRequestId(), FetchNotes()] })

// SUBSCRIPTIONS --------------------------------------------------------------

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  refresh: Subscription.persistentEntry(Stream.tick(REFRESH_EVERY).pipe(Stream.drop(1), Stream.map(() => Message.TickedRefresh())))
}))

// VIEW -----------------------------------------------------------------------
// Pure. Event handlers are Messages, not callbacks. Every state has its own branch:
// loading, empty, failure, stale. Controls are found by role and label in tests, so a
// missing label is a test failure.

const connection = (model: Model) =>
  AsyncData.match(model.notes, {
    onIdle: () => ["pending", "Idle"] as const,
    onLoading: () => ["pending", "Loading…"] as const,
    onRefreshing: () => ["live", "Up to date"] as const,
    onSuccess: () => ["live", "Up to date"] as const,
    onStale: () => ["stale", "Reconnecting…"] as const,
    onFailure: () => ["down", "Unreachable"] as const
  })

const composer = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.form([h.OnSubmit(Message.SubmittedNote()), h.AriaLabel("Add a note"), h.Class("composer")], [
    h.label([h.For("draft")], ["Note"]),
    h.div([h.Class("field")], [
      h.input([h.Id("draft"), h.Value(model.draft), h.Autocomplete("off"), h.OnInput((text) => Message.ChangedDraft({ text }))]),
      h.button([h.Type("submit"), h.Disabled(model.draft.trim() === "" || Option.isNone(model.draftRequestId))], ["Add"])
    ])
  ])

const phaseLabel = (phase: Phase): string => Phase.match(phase, { Saving: () => "saving", Saved: () => "saved", Failed: () => "not saved" })

const pendingView = (pending: Pending, h: HtmlBuilder<Message>): Html =>
  // Keyed by requestId, which is also the saved note's id, so the row keeps its DOM node
  // while its phase changes and when it becomes an ordinary note. The phase class is what
  // the state-change fade hangs on.
  h.keyed("li")(pending.requestId, [h.Class(`item is-pending ${pending.phase._tag.toLowerCase()}`)], [
    h.span([h.Class("text")], [pending.text]),
    h.span([h.Class("badge")], [phaseLabel(pending.phase)]),
    ...Phase.match(pending.phase, {
      Saving: () => [],
      Saved: () => [],
      // The Message keeps the technical cause for tests and DevTools; the screen says it plainly.
      Failed: () => [
        h.p([h.Class("error")], ["Couldn't save this note. Check your connection and retry."]),
        h.button([h.Type("button"), h.OnClick(Message.ClickedRetry({ requestId: pending.requestId })), h.AriaLabel(`Retry ${pending.text}`)], ["Retry"])
      ]
    })
  ])

const noteView = (note: Note, h: HtmlBuilder<Message>): Html =>
  h.keyed("li")(note.id, [h.Class("item")], [h.span([h.Class("text")], [note.text])])

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const [tone, label] = connection(model)
  const unsaved = model.pending.filter((p) => p.phase._tag !== "Saved").length
  const loaded = Option.getOrElse(AsyncData.getData(model.notes), (): ReadonlyArray<Note> => [])
  return {
    title: unsaved > 0 ? `(${unsaved}) Notes` : "Notes",
    body: h.main([h.Class("app")], [
      h.header([h.Class("top")], [
        h.h1([], ["Notes"]),
        h.span([h.Class(`conn ${tone}`), h.Role("status"), h.AriaLive("polite")], [label])
      ]),
      composer(model, h),
      h.section([h.AriaLabel("Notes list")], [
        // One list: unsaved rows first, then loaded notes that aren't already shown as unsaved.
        h.ul([h.Class("items")], [
          ...model.pending.map((p) => pendingView(p, h)),
          ...loaded.filter((n) => !model.pending.some((p) => p.requestId === n.id)).map((n) => noteView(n, h))
        ]),
        AsyncData.matchData(model.notes, {
          onEmpty: () => h.p([h.Class("dim")], ["Loading…"]),
          onFailure: () => h.p([h.Class("error")], ["Couldn't load notes. Retrying every few seconds."]),
          onData: (notes) => (notes.length === 0 && model.pending.length === 0 ? h.p([h.Class("dim")], ["No notes yet. Add the first one above."]) : h.empty)
        })
      ])
    ])
  }
}
