type LocalComponentId = "bge-m3" | "docling";
type LocalComponentState = "missing" | "downloading" | "verifying" | "ready" | "corrupt" | "error";

type LocalComponentStatus = {
  id: LocalComponentId;
  name: string;
  version: string;
  status: LocalComponentState;
  error: string | null;
  downloadedBytes: number;
  totalBytes: number;
};

type LocalComponentsResponse = {
  components: LocalComponentStatus[];
  freeBytes: number;
};

interface Window {
  scholarFlowDesktop?: {
    isDesktop: true;
    platform: string;
    electronVersion: string;
    getComponentStatus(): Promise<LocalComponentsResponse>;
    installComponent(id: LocalComponentId): Promise<LocalComponentStatus>;
    cancelComponentInstall(id: LocalComponentId): Promise<boolean>;
    verifyComponent(id: LocalComponentId): Promise<LocalComponentStatus>;
    removeComponent(id: LocalComponentId): Promise<LocalComponentStatus>;
    onComponentProgress(listener: (status: LocalComponentStatus) => void): () => void;
  };
}
