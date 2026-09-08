import { Observable, Subject } from "rxjs";
import { AppManagementService } from "./app-management/AppManagementService";
import { FileManagementService } from "./file-management/FileManagementService";
import { Parameters } from "./fix/FixSession";

/**
 * Global parameters are shared by every session and stored in `<workingDir>/global_params.json`.
 *
 * The Parameter objects returned by getGlobalParameters() are live: the `{incr:name}` field filler
 * increments `Parameter.count` on them while a message is encoded. persistIfChanged() writes such
 * runtime changes to disk so counters survive an application restart.
 */
export class GlobalParameterService {
    private globalParams: Parameters = {};
    /** JSON of the parameters as last confirmed on disk (written successfully or loaded). */
    private persistedSnapshot = JSON.stringify({});
    /** JSON of the parameters as last handed to persist(); may still be queued or in flight. */
    private requestedSnapshot = JSON.stringify({});
    private queuedSnapshot?: string;
    private writeInFlight = false;
    private updateSubject = new Subject<void>();

    constructor(private appManager: AppManagementService, private fileManager: FileManagementService) {
        if (this.appManager.getWorkingDir()) {
            this.loadGlobalParametersFromDevice();
        }
    }

    getGlobalParameters(): Parameters {
        return this.globalParams;
    }

    /** Emits after every change that reached the parameters map (add, remove, load, persisted counter). */
    getUpdateObservable(): Observable<void> {
        return this.updateSubject.asObservable();
    }

    setGlobalParameter(param: string, value: any) {
        this.globalParams[param] = { value };
        this.persist();
    }

    removeGlobalParameter(param: string) {
        delete this.globalParams[param];
        this.persist();
    }

    /**
     * Writes the parameters to disk if anything changed since the last write, typically a counter
     * incremented by an `{incr:}` filler. Returns whether a write was issued.
     */
    persistIfChanged(): boolean {
        const snapshot = JSON.stringify(this.globalParams);
        // While a write is pending compare against what was requested; otherwise against what is
        // known to be on disk, so a failed write is retried on the next change check.
        const reference = (this.writeInFlight || this.queuedSnapshot !== undefined) ? this.requestedSnapshot : this.persistedSnapshot;
        if (snapshot === reference) {
            return false;
        }

        this.persist(snapshot);
        return true;
    }

    private persist(snapshot = JSON.stringify(this.globalParams)) {
        this.requestedSnapshot = snapshot;
        this.queuedSnapshot = snapshot;
        this.updateSubject.next();
        this.flushWrites();
    }

    /**
     * Writes one snapshot at a time so writes to global_params.json never overlap (a torn file
     * would lose every parameter on the next start). Intermediate states are skipped: only the
     * latest queued snapshot is written once the in-flight write completes.
     */
    private flushWrites() {
        if (this.writeInFlight || this.queuedSnapshot === undefined || !this.appManager.getWorkingDir()) {
            return;
        }

        const snapshot = this.queuedSnapshot;
        this.queuedSnapshot = undefined;
        this.writeInFlight = true;

        this.fileManager.writeFile(this.appManager.getGlobalParametersFile(), snapshot)
            .then(result => {
                if (result && result.error) {
                    console.error("Failed to write global parameters", result.error);
                } else {
                    this.persistedSnapshot = snapshot;
                }
            })
            .catch(error => console.error("Failed to write global parameters", error))
            .then(() => {
                this.writeInFlight = false;
                this.flushWrites();
            });
    }

    private async loadGlobalParametersFromDevice() {
        let loaded: Parameters = {};
        try {
            const data = await this.fileManager.readFile(this.appManager.getGlobalParametersFile());
            if (data.fileData) {
                const parsed = JSON.parse(data.fileData.data);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    loaded = parsed;
                }
            }
        } catch (err) {
            loaded = {};
        }

        // Merge into the existing map instead of replacing it: parameters added before the read
        // resolved are kept, and references already handed out by getGlobalParameters() stay valid.
        Object.keys(loaded).forEach(key => {
            if (!this.globalParams[key]) {
                this.globalParams[key] = loaded[key];
            }
        });

        this.persistedSnapshot = JSON.stringify(loaded);
        if (!this.writeInFlight && this.queuedSnapshot === undefined) {
            this.requestedSnapshot = this.persistedSnapshot;
        }
        if (!this.persistIfChanged()) {
            this.updateSubject.next();
        }
    }
}
