---
status: accepted
---

# Freeze roadmaps from the academic calendar

Roadmap versions will be frozen automatically at the end of their Academic term using dates extracted from the official [FCFM academic-calendar page](https://ingenieria.uchile.cl/escuela/pregrado/informacion-para-estudiantes/calendarios) and its published semester PDF, rather than through per-course manual closure.

On 15 April (Otoño) and 15 October (Primavera), the scheduled synchronization selects that year's semester-specific PDF from its labelled page section. It extracts the first `ÚLTIMO DÍA DE CLASES` and `EXÁMENES` range, which deliberately excludes a possible appended summer calendar. It persists the source URLs, class end, exam range, and sets `roadmapFreezeDate` to the final exam day. A malformed, missing, oversized, or non-official PDF fails the job without changing the stored Academic term, so Roadmaps retain their last verified reference instead of accepting guessed dates.
