"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getDefaultUiProfile,
  getUiProfile,
  readSavedProfileId,
  saveProfileId,
  UI_SCAN_PROFILES,
  type UiScanProfile,
} from "@/lib/profiles";

type ProfileSwitcherProps = {
  onProfileChange?: (profile: UiScanProfile) => void;
  className?: string;
};

export default function ProfileSwitcher({ onProfileChange, className }: ProfileSwitcherProps) {
  const [profileId, setProfileId] = useState<string>(getDefaultUiProfile().id);

  useEffect(() => {
    const saved = readSavedProfileId();
    const selected = getUiProfile(saved) ?? getDefaultUiProfile();
    setProfileId(selected.id);
    onProfileChange?.(selected);
  }, [onProfileChange]);

  const selectedProfile = useMemo(() => {
    return getUiProfile(profileId) ?? getDefaultUiProfile();
  }, [profileId]);

  const handleProfileChange = (nextProfileId: string) => {
    const nextProfile = getUiProfile(nextProfileId) ?? getDefaultUiProfile();
    setProfileId(nextProfile.id);
    saveProfileId(nextProfile.id);
    onProfileChange?.(nextProfile);
  };

  return (
    <section className={`rounded-xl border bg-card p-4 sm:p-5 ${className ?? ""}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Scan Profile</h2>
          <p className="text-sm text-muted-foreground">Choose a preset for chains, pairs, and quote source coverage.</p>
        </div>
        {selectedProfile.premiumOnly && (
          <span className="rounded-full border border-amber-400/70 bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
            Premium only
          </span>
        )}
      </div>

      <div className="mt-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Preset</span>
          <select
            className="min-h-10 rounded border bg-background px-3 py-2"
            value={selectedProfile.id}
            onChange={(event) => handleProfileChange(event.target.value)}
          >
            {UI_SCAN_PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="mt-3 grid gap-1 text-sm text-muted-foreground">
        <li>chains: {selectedProfile.chains.join(", ")}</li>
        <li>pairs: {selectedProfile.pairs.length}</li>
        <li>quoteSources: {selectedProfile.quoteSources.join(", ")}</li>
        <li>minProfitGap: {selectedProfile.minProfitGap}</li>
        <li>maxConcurrency: {selectedProfile.maxConcurrency}</li>
      </ul>

      <p className="mt-2 text-xs text-muted-foreground">{selectedProfile.notes}</p>
    </section>
  );
}
