-- Serializable Roadmap edits look up a target's Known values across recipients
-- (e.g. unrecognized creations of a deleted Node) by Roadmap and target key; an
-- exact index keeps their predicate locks to those rows (#220).
CREATE INDEX "NoticeKnownValue_roadmapId_targetKey_idx" ON "NoticeKnownValue"("roadmapId", "targetKey");
