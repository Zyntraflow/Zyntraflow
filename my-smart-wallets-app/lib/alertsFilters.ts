import type { UiScanProfile } from "./profiles";

export type AlertEventLite = {
  chainId: number;
  pair: string;
  mode: "free" | "premium";
};

export type AlertsFilterInput = {
  events: AlertEventLite[];
  chainIdFilter: "all" | number;
  modeFilter: "all" | "free" | "premium";
  profileFilter?: UiScanProfile | null;
};

export const filterAlerts = <T extends AlertEventLite>(input: Omit<AlertsFilterInput, "events"> & { events: T[] }): T[] => {
  return input.events.filter((event) => {
    if (input.chainIdFilter !== "all" && event.chainId !== input.chainIdFilter) {
      return false;
    }
    if (input.modeFilter !== "all" && event.mode !== input.modeFilter) {
      return false;
    }
    if (!input.profileFilter) {
      return true;
    }
    const inChain = input.profileFilter.chains.includes(event.chainId);
    const inPair = input.profileFilter.pairs.includes(event.pair.toUpperCase());
    return inChain && inPair;
  });
};

export const getChainFilterOptions = (events: AlertEventLite[]): number[] => {
  return [...new Set(events.map((event) => event.chainId).filter((id) => Number.isInteger(id) && id > 0))].sort(
    (a, b) => a - b,
  );
};
