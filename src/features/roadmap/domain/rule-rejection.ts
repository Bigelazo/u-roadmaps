/** A Roadmap rule's refusal, with the explanation every adapter shows. */
export type RuleRejection<Reason extends string> = {
  kind: 'REJECTED';
  reason: Reason;
  message: string;
};

export function ruleRejection<Reason extends string>(
  reason: Reason,
  message: string,
): RuleRejection<Reason> {
  return { kind: 'REJECTED', reason, message };
}
