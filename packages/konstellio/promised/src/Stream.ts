import { Readable, WritableOptions, Writable, DuplexOptions, Duplex, TransformOptions, Transform } from 'stream';

export interface TypedReadable<T = any> extends Readable {
	read(size?: number): T;

	unshift(chunk: T): void;

	push(chunk: T, encoding?: string): boolean;

	addListener(event: 'close', listener: () => void): this;
	addListener(event: 'data', listener: (chunk: T) => void): this;
	addListener(event: 'end', listener: () => void): this;
	addListener(event: 'readable', listener: () => void): this;
	addListener(event: 'error', listener: (err: Error) => void): this;
	addListener(event: string | symbol, listener: (...args: any[]) => void): this;

	emit(event: 'close'): boolean;
	emit(event: 'data', chunk: T): boolean;
	emit(event: 'end'): boolean;
	emit(event: 'readable'): boolean;
	emit(event: 'error', err: Error): boolean;
	emit(event: string | symbol, ...args: any[]): boolean;

	on(event: 'close', listener: () => void): this;
	on(event: 'data', listener: (chunk: T) => void): this;
	on(event: 'end', listener: () => void): this;
	on(event: 'readable', listener: () => void): this;
	on(event: 'error', listener: (err: Error) => void): this;
	on(event: string | symbol, listener: (...args: any[]) => void): this;

	once(event: 'close', listener: () => void): this;
	once(event: 'data', listener: (chunk: T) => void): this;
	once(event: 'end', listener: () => void): this;
	once(event: 'readable', listener: () => void): this;
	once(event: 'error', listener: (err: Error) => void): this;
	once(event: string | symbol, listener: (...args: any[]) => void): this;

	prependListener(event: 'close', listener: () => void): this;
	prependListener(event: 'data', listener: (chunk: T) => void): this;
	prependListener(event: 'end', listener: () => void): this;
	prependListener(event: 'readable', listener: () => void): this;
	prependListener(event: 'error', listener: (err: Error) => void): this;
	prependListener(event: string | symbol, listener: (...args: any[]) => void): this;

	prependOnceListener(event: 'close', listener: () => void): this;
	prependOnceListener(event: 'data', listener: (chunk: T) => void): this;
	prependOnceListener(event: 'end', listener: () => void): this;
	prependOnceListener(event: 'readable', listener: () => void): this;
	prependOnceListener(event: 'error', listener: (err: Error) => void): this;
	prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;

	removeListener(event: 'close', listener: () => void): this;
	removeListener(event: 'data', listener: (chunk: T) => void): this;
	removeListener(event: 'end', listener: () => void): this;
	removeListener(event: 'readable', listener: () => void): this;
	removeListener(event: 'error', listener: (err: Error) => void): this;
	removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
}

export interface TypedWritableOptions<T = any> extends WritableOptions {
	write?(this: Writable, chunk: T, encoding: string, callback: (error?: Error | null) => void): void;
	writev?(this: Writable, chunks: { chunk: T; encoding: string }[], callback: (error?: Error | null) => void): void;
}

export interface TypedWritable<T = any> extends Writable {
	new (opts?: TypedWritableOptions<T>): this;

	_write(chunk: T, encoding: string, callback: (error?: Error | null) => void): void;
	_writev?(chunks: { chunk: T; encoding: string }[], callback: (error?: Error | null) => void): void;

	write(chunk: T, cb?: (error: Error | null | undefined) => void): boolean;
	write(chunk: T, encoding?: string, cb?: (error: Error | null | undefined) => void): boolean;

	end(cb?: () => void): void;
	end(chunk: T, cb?: () => void): void;
	end(chunk: T, encoding?: string, cb?: () => void): void;
	end(chunk: any, encoding?: string, cb?: () => void): void;
}

export interface TypedDuplexOptions<T = any> extends DuplexOptions {
	write?(this: Duplex, chunk: T, encoding: string, callback: (error?: Error | null) => void): void;
	writev?(this: Duplex, chunks: { chunk: T; encoding: string }[], callback: (error?: Error | null) => void): void;
}

export interface TypedDuplex<T = any> extends Duplex {
	new (opts?: TypedDuplexOptions<T>): this;

	_write(chunk: T, encoding: string, callback: (error?: Error | null) => void): void;
	_writev?(chunks: { chunk: T; encoding: string }[], callback: (error?: Error | null) => void): void;

	write(chunk: T, cb?: (error: Error | null | undefined) => void): boolean;
	write(chunk: T, encoding?: string, cb?: (error: Error | null | undefined) => void): boolean;

	end(cb?: () => void): void;
	end(chunk: T, cb?: () => void): void;
	end(chunk: T, encoding?: string, cb?: () => void): void;
	end(chunk: any, encoding?: string, cb?: () => void): void;
}

export type TypedTransformCallback<T = any> = (error?: Error, data?: T) => void;

export interface TypedTransformOptions<T = any> extends TypedDuplexOptions<T> {
	read?(this: Transform, size: number): void;
	write?(this: Transform, chunk: T, encoding: string, callback: (error?: Error | null) => void): void;
	writev?(this: Transform, chunks: { chunk: T; encoding: string }[], callback: (error?: Error | null) => void): void;
	final?(this: Transform, callback: (error?: Error | null) => void): void;
	destroy?(this: Transform, error: Error | null, callback: (error: Error | null) => void): void;
	transform?(this: Transform, chunk: T, encoding: string, callback: TypedTransformCallback<T>): void;
	flush?(this: Transform, callback: TypedTransformCallback<T>): void;
}

export interface TypedTransform<T = any> extends TypedDuplex<T> {
	new (opts?: TypedTransformOptions<T>): this;
	_transform(chunk: T, encoding: string, callback: TypedTransformCallback<T>): void;
	_flush(callback: TypedTransformCallback<T>): void;
}
