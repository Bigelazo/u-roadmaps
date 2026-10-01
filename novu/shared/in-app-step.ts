import { step } from '@novu/framework/step-resolver';
import {
  projectDigestNotification,
  type DigestNotificationProjection,
} from '../../src/features/notifications/digest-projection';

type ResolverContext = Readonly<{
  payload: Record<string, unknown>;
  steps: Record<string, unknown>;
}>;

type InAppStepResolver = Readonly<{
  type: 'in_app';
  stepId: string;
  resolve: (controls: unknown, context: ResolverContext) => Promise<DigestNotificationProjection>;
}>;

type InAppStepFactory = (
  stepId: string,
  resolve: (controls: unknown, context: ResolverContext) => Promise<DigestNotificationProjection>,
) => InAppStepResolver;

// The SDK's recursive resolver generics exceed TypeScript's instantiation limit here.
const createInAppStep = step.inApp as unknown as InAppStepFactory;

export function createNotificationInAppStep() {
  return createInAppStep('in-app', async (_controls, context) => {
    const digestStep = context.steps.digest;
    const events =
      typeof digestStep === 'object' && digestStep !== null && 'events' in digestStep
        ? digestStep.events
        : [];

    return projectDigestNotification(context.payload, Array.isArray(events) ? events : []);
  });
}
