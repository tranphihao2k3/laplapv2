import { create } from "zustand";
import { persist } from "zustand/middleware";

type OrgInfo = {
  id: string;
  name: string;
  code: string | null;
};

interface OrgState {
  currentOrg: OrgInfo | null;
  availableOrgs: OrgInfo[];
  setCurrentOrg: (org: OrgInfo | null) => void;
  setAvailableOrgs: (orgs: OrgInfo[]) => void;
  clear: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      currentOrg: null,
      availableOrgs: [],
      setCurrentOrg: (org) => set({ currentOrg: org }),
      setAvailableOrgs: (orgs) => set({ availableOrgs: orgs }),
      clear: () => set({ currentOrg: null, availableOrgs: [] }),
    }),
    { name: "laplap-org", partialize: (state) => ({ currentOrg: state.currentOrg }) },
  ),
);
