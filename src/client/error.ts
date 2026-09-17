/** The vault said no (or the network did). Dependency-free so the guard package can reference it. */
export class OneClawApiError extends Error {
    constructor(
        public status: number,
        public detail: string,
    ) {
        super(detail);
        this.name = "OneClawApiError";
    }
}
