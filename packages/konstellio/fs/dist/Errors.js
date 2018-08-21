"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class FileSystemError extends Error {
}
exports.FileSystemError = FileSystemError;
class CouldNotConnect extends FileSystemError {
    constructor(error) {
        super(`Could not connect to file system : ${error && error.stack}`);
        this.code = 'ERR_COULD_NOT_CONNECT';
    }
}
exports.CouldNotConnect = CouldNotConnect;
class FileNotFound extends FileSystemError {
    constructor(file) {
        super(file ? `File ${file} not found.` : `File not found`);
        this.code = 'ERR_FILE_NOT_FOUND';
    }
}
exports.FileNotFound = FileNotFound;
class FileAlreadyExists extends FileSystemError {
    constructor(file) {
        super(file ? `File ${file} already exists.` : `File already exists`);
        this.code = 'ERR_FILE_ALREADY_EXISTS';
    }
}
exports.FileAlreadyExists = FileAlreadyExists;
class OperationNotSupported extends FileSystemError {
    constructor(op) {
        super(op ? `Operation ${op} not supported.` : `Operation not supported`);
        this.code = 'ERR_OPERATION_NOT_SUPPORTED';
    }
}
exports.OperationNotSupported = OperationNotSupported;
//# sourceMappingURL=Errors.js.map