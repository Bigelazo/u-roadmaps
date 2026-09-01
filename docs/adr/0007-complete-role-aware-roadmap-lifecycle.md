---
status: proposed
---

# Complete the role-aware roadmap lifecycle

Development fixtures may represent the intended roadmap lifecycle before every part of that lifecycle is implemented. Future work must persist coordinated **Course sections**, their student membership and responsible course professors, as well as each teaching participant's **Institutional course position**. It must restrict roadmap creation and roster synchronization to **Course professors**, allow every teaching position—including coordinating professors, auxiliary professors, and teaching assistants—to edit a current **Roadmap**, and derive read-only status from the official **Academic term** closure described by ADR-0001. At closure, the system must atomically remove every **Teacher block** before freezing the Roadmap, while preserving hidden Nodes unchanged; after that transition, teaching staff cannot edit the historical version in any way. Authorization must be enforced by the server rather than only by hiding controls in the interface.

A course professor must also be able to create the current course offering's Roadmap by copying a previous version from the same **Roadmap lineage**. The copy must use fresh identities for the Roadmap, its Nodes, Dependencies, Custom node types, and Resources; retain pedagogical content; record the source version; and exclude Participations and Completions. External links are duplicated as independent Resource records. Uploaded files receive new `fileKey` values and duplicated bytes, so deleting or replacing material in one version cannot affect another. The creation interface must expose both an empty-roadmap path and an eligible-previous-version path, while closed historical versions remain readable but immutable for every participant.

Until these capabilities exist, the corresponding fixture scenarios are test inputs for future implementation rather than evidence that the permissions, closure, or copy behavior already works.

## Student progress tracking

U-Roadmaps also lacks **Student progress tracking** for a Course offering. Future work must present realistic basic institutional identity, Course section, active or withdrawn Participation, latest Platform entry—including people who have never entered—and visible Nodes completed over the total with the resulting percentage. Every teaching position retains the offering-wide visibility defined by the domain model. Hidden Nodes must not be presented as student work awaiting completion, and RUT remains identity data rather than a default bulk-list field. The development dataset will retain a larger non-selectable student roster specifically to exercise this future view; those records must use plausible names and institutional data rather than numbered placeholders.
