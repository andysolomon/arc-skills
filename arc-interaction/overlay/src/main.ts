/**
 * A Foldkit program: The Elm Architecture on Effect. Definitions only; nothing runs here.
 *
 *   model.ts     Model + Messages (Schemas)
 *   commands.ts  side effects as values
 *   mounts.ts    imperative DOM code as values (arc-interaction: swipe, layout move, figure)
 *   main.ts      update + init + subscriptions + view   <- this file
 *   entry.ts     boots the browser Runtime (the only file that touches `document`)
 */
import { Duration, Option, Result, Stream } from "effect"
import type { HttpClient } from "effect/http"
import { AsyncData, Subscription, type Update } from "foldkit"
import type { Document, Html, HtmlBuilder } from "foldkit/html"
import { modifyFields } from "foldkit/struct"
import { FetchNotes, MintRequestId, RemoveNote, SaveNote } from "./commands.ts"
import { Message, type Model, type Note, type Pending, Phase, type Removal, RemovePhase } from "./model.ts"
import { DrawEmptyFigure, MoveRows, SwipeNote } from "./mounts.ts"

export { Model } from "./model.ts"

type Return = Update.Return<Model, Message, HttpClient.HttpClient>

export const REFRESH_EVERY = Duration.seconds(5)

// UPDATE ---------------------------------------------------------------------
// Pure. The only place state changes. No clocks, no randomness, no fetch.

const setPending = (model: Model, requestId: string, f: (p: Pending) => Pending): Model =>
  modifyFields(model, { pending: (ps) => ps.map((p) => (p.requestId === requestId ? f(p) : p)) })

// arc-interaction: removal ------------------------------------------------------
const setRemoval = (model: Model, noteId: string, f: (r: Removal) => Removal): Model =>
  modifyFields(model, { removing: (rs) => rs.map((r) => (r.noteId === noteId ? f(r) : r)) })

/**
 * The swipe and the Remove button both land here. The Model decides: a note that isn't
 * loaded, or is already being removed, changes nothing, so a swipe and a click on the same
 * row send one request.
 */
const startRemove = (model: Model, noteId: string): Return => {
  const loaded = Option.getOrElse(AsyncData.getData(model.notes), (): ReadonlyArray<Note> => [])
  if (!loaded.some((n) => n.id === noteId) || model.removing.some((r) => r.noteId === noteId)) return { model }
  return {
    model: modifyFields(model, { removing: (rs) => [...rs, { noteId, phase: RemovePhase.Removing() }] }),
    commands: [RemoveNote({ noteId })]
  }
}

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

    // arc-interaction: two sources, one decision.
    SwipedAwayNote: ({ noteId }) => startRemove(model, noteId),
    ClickedRemove: ({ noteId }) => startRemove(model, noteId),

    ClickedRetryRemove: ({ noteId }) => {
      const removal = model.removing.find((r) => r.noteId === noteId)
      if (removal === undefined || removal.phase._tag !== "Failed") return { model }
      return { model: setRemoval(model, noteId, (r) => ({ ...r, phase: RemovePhase.Removing() })), commands: [RemoveNote({ noteId })] }
    },

    // The user gives up on a failed removal: the note stays, as an ordinary row.
    ClickedKeep: ({ noteId }) => ({
      model: modifyFields(model, { removing: (rs) => rs.filter((r) => r.noteId !== noteId || r.phase._tag !== "Failed") })
    }),

    // The row stays hidden until a list load no longer shows the note.
    SucceededRemoveNote: ({ noteId }) => ({
      model: setRemoval(model, noteId, (r) => (r.phase._tag === "Removing" ? { ...r, phase: RemovePhase.Removed() } : r))
    }),

    FailedRemoveNote: ({ noteId, error }) => ({
      model: setRemoval(model, noteId, (r) => (r.phase._tag === "Removing" ? { ...r, phase: RemovePhase.Failed({ error }) } : r))
    }),

    // A Mount that only sets something up reports that it did. The Model has nothing to change.
    CompletedAttachSwipe: () => ({ model }),
    CompletedMoveRows: () => ({ model }),
    CompletedDrawEmptyFigure: () => ({ model }),

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
        // A row leaves the pending list once the loaded list shows its note. That includes a
        // Failed row whose reply was lost after the server stored it. Saving rows stay: their
        // own reply decides.
        pending: (ps) => ps.filter((p) => p.phase._tag === "Saving" || !notes.some((n) => n.id === p.requestId)),
        // arc-interaction: a removal is settled once the loaded list no longer shows its note.
        // That includes a Failed one whose reply was lost after the server removed the note.
        // Removing entries stay: their own reply decides.
        removing: (rs) => rs.filter((r) => r.phase._tag === "Removing" || notes.some((n) => n.id === r.noteId))
      })
    }),

    // Keep the last good list on screen (Stale) instead of blanking it.
    FailedFetchNotes: ({ error }) => ({ model: modifyFields(model, { notes: (current) => AsyncData.settle(current, Result.fail(error)) }) })
  })

// INIT -----------------------------------------------------------------------

export const emptyModel: Model = { notes: AsyncData.Loading(), draft: "", draftRequestId: Option.none(), pending: [], removing: [] }

export const init = (): Return => ({ model: emptyModel, commands: [MintRequestId(), FetchNotes()] })

// SUBSCRIPTIONS --------------------------------------------------------------

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  refresh: Subscription.persistentEntry(Stream.tick(REFRESH_EVERY).pipe(Stream.drop(1), Stream.map(() => Message.TickedRefresh())))
}))

// VIEW -----------------------------------------------------------------------
// Pure. Imperative DOM code enters only as `h.OnMount(Definition(args))`, from mounts.ts. Event handlers are Messages, not callbacks. Every state has its own branch:
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

// arc-interaction: a loaded note is a row the user can swipe away. The Mount sits on an
// inner element, because the row itself (the `li`) is moved by the list's layout Mount and
// one element can't carry two transforms. The Remove button does what the swipe does, for
// keyboards and screen readers: a gesture is never the only way.
const noteView = (note: Note, h: HtmlBuilder<Message>): Html =>
  h.keyed("li")(note.id, [h.Class("item")], [
    h.div([h.Class("swipe"), h.OnMount(SwipeNote({ noteId: note.id }))], [
      h.span([h.Class("text")], [note.text]),
      h.button([h.Type("button"), h.Class("quiet"), h.OnClick(Message.ClickedRemove({ noteId: note.id })), h.AriaLabel(`Remove ${note.text}`)], ["Remove"])
    ])
  ])

// A removal that failed: the row is back, it says so, and it offers both ways out. No swipe here.
const failedRemovalView = (note: Note, h: HtmlBuilder<Message>): Html =>
  h.keyed("li")(note.id, [h.Class("item failed")], [
    h.span([h.Class("text")], [note.text]),
    h.span([h.Class("badge")], ["not removed"]),
    h.p([h.Class("error")], ["Couldn't remove this note. Check your connection and retry."]),
    h.button([h.Type("button"), h.OnClick(Message.ClickedRetryRemove({ noteId: note.id })), h.AriaLabel(`Retry removing ${note.text}`)], ["Retry"]),
    h.button([h.Type("button"), h.Class("quiet"), h.OnClick(Message.ClickedKeep({ noteId: note.id })), h.AriaLabel(`Keep ${note.text}`)], ["Keep"])
  ])

const EMPTY_FIGURE_LABEL = "An empty drawer"

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const [tone, label] = connection(model)
  const unsaved = model.pending.filter((p) => p.phase._tag !== "Saved").length
  const loaded = Option.getOrElse(AsyncData.getData(model.notes), (): ReadonlyArray<Note> => [])
  // arc-interaction: a note being removed is hidden at once. A failed removal shows again.
  const removalOf = (id: string) => model.removing.find((r) => r.noteId === id)
  const isHidden = (id: string) => {
    const removal = removalOf(id)
    return removal !== undefined && removal.phase._tag !== "Failed"
  }
  const rows = loaded.filter((n) => !model.pending.some((p) => p.requestId === n.id) && !isHidden(n.id))
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
        // arc-interaction: MoveRows makes the other rows travel when one is added or removed.
        h.ul([h.Class("items"), h.OnMount(MoveRows())], [
          ...model.pending.map((p) => pendingView(p, h)),
          ...rows.map((n) => (removalOf(n.id) === undefined ? noteView(n, h) : failedRemovalView(n, h)))
        ]),
        AsyncData.matchData(model.notes, {
          onEmpty: () => h.p([h.Class("dim")], ["Loading…"]),
          onFailure: () => h.p([h.Class("error")], ["Couldn't load notes. Retrying every few seconds."]),
          // arc-interaction: the empty state gets a figure. The text still says how to add the first note.
          onData: () =>
            rows.length === 0 && model.pending.length === 0
              ? h.div([h.Class("empty")], [
                h.div([h.Class("figure"), h.Role("img"), h.AriaLabel(EMPTY_FIGURE_LABEL), h.OnMount(DrawEmptyFigure({ label: EMPTY_FIGURE_LABEL }))], []),
                h.p([h.Class("dim")], ["No notes yet. Add the first one above."])
              ])
              : h.empty
        })
      ])
    ])
  }
}
