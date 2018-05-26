

export class FileNotFound extends Error {
	constructor(file?: string) {
		super(file ? `File ${file} not found.` : `File not found`);
		(this as any).code = 'ERR_FILE_NOT_FOUND';
	}
}

export class FileAlreadyExists extends Error {
	constructor(file?: string) {
		super(file ? `File ${file} already exists.` : `File already exists`);
		(this as any).code = 'ERR_FILE_ALREADY_EXISTS';
	}
}

export class OperationNotSupported extends Error {
	constructor(op?: string) {
		super(op ? `Operation ${op} not supported.` : `Operation not supported`);
		(this as any).code = 'ERR_OPERATION_NOT_SUPPORTED';
	}
}