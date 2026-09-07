---
status: proposed
---

# Unify teacher unlocking behind one context-sensitive Node action

Teaching staff will use one **Node unlock** action instead of separate individual and branch controls. When the selected **Node** has any direct or transitive prerequisite with a **Teacher block**, the action atomically unlocks the selected Node and every blocked transitive prerequisite without changing dependents; otherwise, teaching staff choose between unlocking only the selected Node and performing the existing **Branch unlock**, whose eligibility rules continue to protect dependents held by blocked prerequisites outside the branch. This context-sensitive behavior reduces routine editing friction while preserving the Roadmap's access invariants, so the server must preview the exact affected Nodes and require renewed confirmation whenever that impact changes before mutation.

## Consequences

The same visible action can traverse the Roadmap in different directions, so confirmations must name the selected, prerequisite, and dependent Nodes rather than relying on the action label alone. Teacher-block provenance remains unrecorded, and Dependencies are used to calculate impact but are not themselves unlocked or modified.
