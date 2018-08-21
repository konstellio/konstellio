import { FileSystem, Stats } from "../FileSystem";
export declare function lstree(fs: FileSystem, path: string): AsyncIterableIterator<[string, Stats]>;
