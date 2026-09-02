import 'server-only';

import {
  developmentEnvironmentEnabled as developmentEnvironmentIsEnabled,
  fixtureEnvironmentEnabled as fixtureEnvironmentIsEnabled,
  requireFixtureEnvironment as requireApprovedFixtureEnvironment,
} from './fixture-environment';

export function developmentEnvironmentEnabled() {
  return developmentEnvironmentIsEnabled(process.env);
}

export function fixtureEnvironmentEnabled() {
  return fixtureEnvironmentIsEnabled(process.env);
}

export function requireFixtureEnvironment() {
  requireApprovedFixtureEnvironment(process.env);
}
