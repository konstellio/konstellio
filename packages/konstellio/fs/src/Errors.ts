export class FileSystemError extends Error {}

export class CouldNotConnect extends FileSystemError {
	constructor(error?: Error) {
		super(`Could not connect to file system : ${error && error.stack}`);
		(this as any).code = 'ERR_COULD_NOT_CONNECT';
	}
}

export class FileNotFound extends FileSystemError {
	constructor(file?: string) {
		super(file ? `File ${file} not found.` : `File not found`);
		(this as any).code = 'ERR_FILE_NOT_FOUND';
	}
}

export class FileAlreadyExists extends FileSystemError {
	constructor(file?: string) {
		super(file ? `File ${file} already exists.` : `File already exists`);
		(this as any).code = 'ERR_FILE_ALREADY_EXISTS';
	}
}

export class OperationNotSupported extends FileSystemError {
	constructor(op?: string) {
		super(op ? `Operation ${op} not supported.` : `Operation not supported`);
		(this as any).code = 'ERR_OPERATION_NOT_SUPPORTED';
	}
}
