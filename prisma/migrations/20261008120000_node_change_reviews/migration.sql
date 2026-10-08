-- Opening a Node reviews its changes for the canvas mark. Roadmap recognition
-- empties the Inbox but leaves this mark until the Node itself is opened.
CREATE TABLE "NodeChangeReview" (
    "recipientId" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "reviewedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NodeChangeReview_pkey" PRIMARY KEY ("recipientId","nodeId")
);

CREATE INDEX "NodeChangeReview_nodeId_idx" ON "NodeChangeReview"("nodeId");

ALTER TABLE "NodeChangeReview" ADD CONSTRAINT "NodeChangeReview_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NodeChangeReview" ADD CONSTRAINT "NodeChangeReview_nodeId_fkey"
  FOREIGN KEY ("nodeId") REFERENCES "RoadmapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notices recognized before this migration were already shown in an entry
-- summary under the previous rules; they must not light up every canvas.
INSERT INTO "NodeChangeReview" ("recipientId", "nodeId", "reviewedAt")
SELECT n."recipientId", node.id, max(n."availableAt")
FROM "RoadmapNotice" n
JOIN "RoadmapNode" node ON node.id::text = n.data->>'nodeId'
WHERE n."acknowledgedAt" IS NOT NULL
GROUP BY n."recipientId", node.id;

-- Access bodies describe what happened to the Node, mirroring nodeAccessChangeText.
UPDATE "RoadmapNotice"
SET body = '«' || (data->>'nodeTitle') || '» ' || CASE
  WHEN data->>'currentValue' = 'Retirado' THEN 'fue ocultado del Roadmap.'
  WHEN data->>'knownValue' = 'Retirado' AND data->>'currentValue' = 'Bloqueado'
    THEN 'volvió a mostrarse en el Roadmap, pero está bloqueado.'
  WHEN data->>'knownValue' = 'Retirado' THEN 'volvió a mostrarse en el Roadmap.'
  WHEN data->>'currentValue' = 'Bloqueado' THEN 'fue bloqueado.'
  ELSE 'fue desbloqueado.'
END
WHERE data->>'noticeTarget' = 'node-access' AND jsonb_typeof(data->'nodeTitle') = 'string';
