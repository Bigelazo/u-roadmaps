---
status: accepted
---

# Recognize Roadmap change notices in their destination context

A Novu notice becomes **seen** when its row is shown in the Inbox; this does not remove pending indicators. It becomes **read** when the participant enters the context where the change can be understood: entering the Roadmap recognizes its general changes and notices for Nodes whose detail is inaccessible to that Participation (because of a block, hiding, or deletion), while opening an accessible Node recognizes all its pending notices, including each Novu Change summary as one notice. Opening the Inbox or a notice dialog alone does not recognize anything. This keeps indicators on Nodes that the participant has not opened and avoids an explicit “mark as reviewed” action.

Selecting a notice navigates to the Roadmap before opening its dialog. Notices that arrive while their destination is already open stay pending until a new opening. Delivery to a Participation stops when it loses access, but notices delivered earlier remain; selecting one then leads to the Academic overview with an explanation and recognizes that notice. These rules replace the earlier interaction and acknowledgment behavior in the #129 prototype.
