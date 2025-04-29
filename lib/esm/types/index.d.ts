interface LogDBOptions {
    maxFileSize?: number;
    maxFileCount?: number;
    rotationEnabled?: boolean;
    addTimestamp?: boolean;
}
export interface LogDB<T> {
    add: (entry: T | T[]) => Promise<void>;
    last: (n?: number) => Promise<(T & {
        timestamp: string;
    })[]>;
    readRaw: () => Promise<string>;
    clear: () => Promise<void>;
}
export declare function SimpleLogDB<T extends object>(filePath: string, options?: LogDBOptions): LogDB<T>;
export {};
//# sourceMappingURL=index.d.ts.map