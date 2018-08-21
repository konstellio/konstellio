export declare class FileSystemError extends Error {
}
export declare class CouldNotConnect extends FileSystemError {
    constructor(error?: Error);
}
export declare class FileNotFound extends FileSystemError {
    constructor(file?: string);
}
export declare class FileAlreadyExists extends FileSystemError {
    constructor(file?: string);
}
export declare class OperationNotSupported extends FileSystemError {
    constructor(op?: string);
}
