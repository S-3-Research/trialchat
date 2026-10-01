# Bookmarked Trials

Entry point: `/bookmarks` (header navigation). Search results in
`/chat` and the full-page collection reuse `TrialCard`.

## Ownership and persistence

Bookmarks are reference-only records, stored per existing guest user ID in
browser localStorage (`trialchat:bookmark:<userId>:<trialId>`). A key per trial
avoids losing unrelated additions from another tab. Bookmark actions are direct
storage mutations and never create chat messages or call the agent. Browser
storage errors are surfaced; same-tab events, storage events and window focus
refresh the collection. Test-mode visitors use their separate existing identity.

This follows the application's current guest-only model. It does not provide
account authentication, cross-device synchronization, or recovery after clearing
browser storage. A future authenticated bookmark repository can replace these
storage functions without changing the thread context contract.

Threads remain normal LangGraph threads, owned through their usual `userId`
metadata. There is no permanent bookmark thread. Creating from all bookmarks
uses `bookmark_full_snapshot`; creating from selected or single trials uses
`bookmark_picked_snapshot`. Creation saves `contextScope` — including each
trial's data as captured at bookmark time — into the graph checkpoint
before navigating. The intent is prefilled in the composer without sending a
message automatically. Titles and scope counts appear in normal history.

## Fixed conversation scope

The checkpoint is authoritative for membership. Once created, a bookmark or
selection scope cannot be cleared, replaced, or expanded. Legacy threads freeze
at their current saved membership; legacy revision fields are ignored. There is
no scope synchronization or revision UI. The proxy rejects explicit changes
with HTTP 409; the graph reducer preserves an existing snapshot even if a write
bypasses the proxy. It deliberately does not throw on overrides because failed
LangGraph run writes can remain pending and otherwise break history reads.

The right-hand Snapshot Panel reuses `TrialPanelShell` and `TrialCard`, displaying
the included trials, count, capture date, and the trial details saved at that
time (never re-fetched). It has no bookmark
toggle, search/refine controls, or new-result pagination. Clicking a card only
highlights it locally. Scope loading failures block the composer/search controls
until retry, rather than treating an unknown thread as a normal search thread.

The ordinary search bridge and search persistence adapter are disabled for scoped
threads. Scoped conversations always route to the trial specialist, which only
binds `trial_details` and validates every requested ID against the saved scope.
Discovery and web-search tools are unavailable, including to hallucinated calls.
Follow-up suggestions are instructed to stay within the set. Requests for more
trials link to `/chat?new=1`, a fresh normal search conversation.

For all-bookmark snapshots, changed live membership shows an informational notice
and an action to create a new conversation with current bookmarks. Subset/single
selections do not incorrectly treat unselected bookmarks as later changes.
Empty collections direct back to Bookmarks. No existing messages are rewritten.

## Current trial data

The collection reads each trial's data directly from its stored bookmark using
[ClinicalTrials.gov API v2](https://clinicaltrials.gov/data-api/api), with bounded
client concurrency. Failed or unsupported IDs stay in the collection as ID-only
cards with an error and a refresh action. Filtering does not delete records.
The resolver supports NCT IDs; non-NCT IDs remain saved but need a data-source
adapter to resolve their details.

The agent gets only the saved scope IDs each turn. `trial_details` fetches
relevant current records on demand (up to ten per call); full trial payloads
are never stored in bookmarks or injected from the live collection.

## Verification

- `npm test --workspace=apps/web`: bookmark isolation/idempotency, snapshot
  independence, fixed membership, empty-scope rejection, normal thread
  creation/failure handling, live details/missing IDs, existing search isolation.
- `npm test --workspace=apps/agent`: graph checkpoint/run immutability and tool restrictions.
- `npx tsc --noEmit -p apps/agent/tsconfig.json`
- Targeted ESLint for changed frontend files.
- Local Next.js route render verified for the collection and its controls.

Full web typecheck currently reports existing errors in `useVoiceInput.ts`
(SpeechRecognition declarations) and `lib/types/prompts.ts` (ChatKit prompt
content type). 
