# Node editor asynchronous command lifecycle research

Investigated 2026-11-03. Application source was read, not modified. This note combines primary-source research, application inspection, and isolated diagnostic tests. No application implementation was changed.

## Recommendation

Prefer removing `mountedRef` and its two result guards from `NodeEditor` over merely resetting it to `true` in Effect setup. Keep guard-promise cleanup (`settleGuard(false)`) and keep the reducer's existing operation identity and epoch rules. The reason is semantic: a save initiated by an event belongs to the editor operation, not to whether React currently has its Effects connected.

Adding `mountedRef.current = true` in setup is a valid narrow correction of the observed initial Strict Mode failure. It does not address a save settling while Effects are disconnected but component state is retained. Removing the guards addresses both without introducing a new lifecycle abstraction. This recommendation is supported by the application implementation, the React sources below, and the isolated lifecycle characterization described below. The recommended change has not been applied to, or validated as a patch against, the full editor.

## Primary React evidence

- [StrictMode reference](https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-re-running-effects-in-development): Strict Mode runs an extra development-only Effect setup/cleanup cycle. The current editor's cleanup sets the ref false without a setup restoring it. A symmetric setup would fix that specific imbalance. Strict Mode should stay enabled.
- [React working-group discussion 82, Dan Abramov](https://github.com/reactwg/react-18/discussions/82): explains why isMounted checks around event-triggered POST completion are unnecessary for memory safety and can lose the pending-state reset when DOM/state are preserved while Effects disconnect. It also warns against moving mutations into Effects simply to facilitate ignoring completion. A finite Promise and a leaked subscription are different cases. The discussion was written before Activity shipped; it supplies rationale, not the current API contract.
- [React 18 upgrade guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide#other-notable-changes): confirms removal of the unmounted-setState warning because the subscription-oriented warning drove harmful workarounds in ordinary state-update scenarios. This is not permission to leak subscriptions or to keep external listeners after unmount.
- [Activity reference](https://react.dev/reference/react/Activity): hidden Activity preserves child state and DOM while cleaning up Effects; showing it restores Effects. This separates state lifetime from Effect connection lifetime.
- [React 19.2 release](https://react.dev/blog/2025/10/01/react-19-2#activity-): Activity shipped with React 19.2. Hidden mode disconnects Effects and defers updates; visible mode restores Effects. The repository declares React 19.2.8, so this is not merely an unreleased React proposal.
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect): event-specific POST work belongs in event handlers rather than an Effect tied to rendering.
- [useEffect fetching example](https://react.dev/reference/react/useEffect#fetching-data-with-effects): its local `ignore` flag is scoped to the lifetime of a read synchronized with a specific dependency value. It should not be transplanted as a global mounted flag for commands. The editor already uses command identity to determine relevance.

## Application-specific reasoning

Read `src/features/roadmap/editor/NodeEditor.tsx`, especially lines 125–153 and 188–218, and `src/features/roadmap/editor/session.ts`, especially `replace-node`, `confirm-guard`, and `resolve-effect`.

- `transition` updates a ref local to the hook instance using the pure reducer, then calls that instance's React dispatch. It does not call a parent callback, manipulate DOM, navigate, emit notifications, or publish external data.
- A real unmount discards that instance. A late callback closing over its ref/dispatch cannot mutate the newly mounted editor's distinct ref/dispatch. The Promise eventually releases its references. Merely suppressing the state update does not cancel the server mutation.
- A node replacement resets pending operation state through `createState`. A late result with no matching pending operation is ignored.
- `resolve-effect` first matches pending id and captured epoch. It clears matching pending work even when the current draft epoch has moved on, then refrains from applying result-specific draft changes when that draft epoch differs. That distinction avoids wiping newer edits while releasing the shared busy flag.
- During Activity hiding, React state remains relevant. Discarding the terminal result solely because Effects are disconnected can strand the existing pending operation. A symmetric mounted ref still has that problem if the Promise settles in the hidden interval; setting true when shown cannot replay the discarded completion.
- The `settleGuard(false)` cleanup serves a different purpose: release a caller awaiting confirmation. It must not be deleted incidentally with the mounted ref.

## Alternatives and limits

- Reset ref true in setup: smallest emergency patch; preserves redundant lifecycle state and fails the hidden-settlement scenario.
- Remove ref/guards: preferred small design correction; needs tests for real unmount/remount, old-node completion, newer drafts, success/rejection/throw, and Activity hidden completion.
- AbortController: request cancellation is not guaranteed rollback of a POST or upload. Introducing it would require an explicit persistence contract; it is not a substitute for terminal operation state.
- Effect-local ignore or generation token: appropriate for replaceable reads or resources owned by an Effect. Additional lifecycle generations would duplicate existing operation identity here unless another side effect is demonstrated.
- `useActionState`/new mutation framework: broader redesign than this defect warrants; no evidence that existing reducer needs replacement.

No explicit `Activity` or `cacheComponents` occurrence was found in `src` or `next.config.mjs` by targeted search. Therefore the hidden-settlement case is a concrete React compatibility requirement to exercise, not a claim that the current app's production router uses it. The initial reproduction proves a development Strict Mode path; production failure needs separate evidence.

## Runtime characterization performed

A detached temporary worktree at commit `751f261` shared the existing dependencies. Tests ran through the repository lock. The principal checkout and its pre-existing changes were not modified. The installed React version was 19.2.8.

1. A diagnostic harness used the real `nodeEditorReducer` and reproduced the editor's synchronous local-ref reduction followed by React dispatch. It compared the current one-way mounted flag, a symmetric setup/reset flag, and no mounted guard.
2. Under Strict Mode, the current flag left pending work stranded; the symmetric flag and no-guard policy both settled it.
3. With an Activity hidden during operation completion, both mounted-flag policies left work stranded after becoming visible; the no-guard policy settled it.
4. Under the no-guard policy, late completion after replacing the selected node did not overwrite the replacement node.
5. Under the no-guard policy, completion belonging to an unmounted instance did not affect a newly mounted instance.
6. A separate test wrapped the actual unmodified NodeEditor in Activity, without Strict Mode. It submitted a node save, hid the editor, resolved the save, showed the editor, and edited again. The save button remained disabled. This confirms that the diagnostic model exposes a real component-level failure, though Activity was deliberately supplied by the test.

Commands run in the temporary worktree:

```sh
sh scripts/with-test-db.sh notifications node node_modules/vitest/vitest.mjs run tests/features/roadmap/editor/lifecycle-diagnosis.test.tsx
# 8 passed: characterization assertions, including assertions of known bad outcomes.

sh scripts/with-test-db.sh notifications node node_modules/vitest/vitest.mjs run tests/features/roadmap/editor/NodeEditor.test.tsx -t 'diagnosis:'
# 1 passed, 40 skipped: asserts the actual editor remains disabled after hidden completion.
```

These are characterization tests, not eight passing regression tests for an implemented fix. The first group compares policies in a deliberately small harness; it does not apply either alternative to the full NodeEditor. The second group exercises the current actual NodeEditor. Temporary test files were removed after investigation.

## Proposed patch scope and acceptance criteria

Recommended future application change: remove the mounted ref and the guards from both success and exception paths. Keep `settleGuard(false)` in cleanup and preserve all reducer identity/epoch checks. Do not disable Strict Mode, move the write into an Effect, clear pending on a timer, or force remounting as a workaround.

Before considering a future patch complete, exercise the full NodeEditor with Strict Mode and deferred perform results: consecutive node/link/file operations; committed, rejected and thrown results; canonical refresh before and after completion; editing while saving; closing/reopening a resource composer; selecting a different node; real unmount followed by a new instance; and Activity hidden completion. The distinction between an old operation being irrelevant and the matching operation needing to release its busy state must remain intact.

The existing editor tests already cover several late-result and draft-preservation cases, but their common render helper does not enable Strict Mode. Prefer enabling it for the editor test surface and adding missing behavior tests, rather than relying exclusively on a shallow lifecycle model.

## Remaining scope limitations

No end-to-end browser/server reproduction was performed in this follow-up. Server persistence, failure timing, and framework route preservation were inspected but not changed. The request-to-command adapter and session layer already own persistence/reload and session-key validation; the editor's local completion transition performs no external side effect. Removing its local mounted filter does not cancel, repeat, or roll back a server write. Any separate issue involving a mutation that never settles, or stale callbacks with external side effects in another layer, would need its own diagnosis.
