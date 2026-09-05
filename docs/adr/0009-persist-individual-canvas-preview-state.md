---
status: proposed
---

# Persist individual canvas preview state separately from student completions

Simulated node completions from **Canvas preview** will be persisted on the server for each teaching Participation and Roadmap, separately from student **Completions**. They survive switches to editing, navigation, reloads, sessions, and devices until that teaching participant explicitly resets them; they are not shared with other teaching participants and never alter student progress. Server persistence was chosen over browser-only state so the simulation has one durable meaning across devices, while per-participant isolation was chosen over a shared teaching-team simulation so one person's rehearsal and reset cannot disrupt another's.
