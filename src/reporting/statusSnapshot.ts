import { APP_VERSION } from "../version";

export type StatusSnapshot = {
  ts: string;
  chainId: number;
  targetNetwork: string;
  operatorEnabled: boolean;
  lastTickOk: boolean;
  lastReportHash: string | null;
  premiumModeCapable: boolean;
  version: string;
};

export type StatusSnapshotInput = {
  chainId: number;
  targetNetwork: string;
  operatorEnabled: boolean;
  lastTickOk: boolean;
  lastReportHash?: string | null;
  premiumModeCapable: boolean;
};

export const buildStatusSnapshot = (input: StatusSnapshotInput): StatusSnapshot => {
  return {
    ts: new Date().toISOString(),
    chainId: input.chainId,
    targetNetwork: input.targetNetwork,
    operatorEnabled: input.operatorEnabled,
    lastTickOk: input.lastTickOk,
    lastReportHash: input.lastReportHash ?? null,
    premiumModeCapable: input.premiumModeCapable,
    version: APP_VERSION,
  };
};
