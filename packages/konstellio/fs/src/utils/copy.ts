import { FileSystem, Stats, FileSystemPool } from "../FileSystem";
import { dirname } from "path";
import { lstree } from "./lstree";
import { Transform } from "stream";

export function copy(
	fsSource: FileSystem,
	source: string,
	fsDestination: FileSystem,
	destination: string
) {
	const files: [string, Stats][] = [];
	const mkdir = new Transform({
		objectMode: true,
		highWaterMark: 1,
		async transform(chunk, encoding, done) {
			if (chunk[1].isFile) {
				files.push(chunk);
			} else {
				console.log('mkdir', chunk[0]);
			}
			done();
		},
		async flush(done) {
			for (const file of files) {
				this.push(file);
			}
			done();
		}
	});
	const copy = new Transform({
		objectMode: true,
		highWaterMark: 1,
		async transform(chunk, encoding, done) {
			console.log('copy', chunk[0]);
			done(undefined, chunk);
		}
	});
	return lstree(fsSource, source).pipe(mkdir).pipe(copy);
}

// export async function* copy(
// 	fsSource: FileSystem,
// 	source: string,
// 	fsDestination: FileSystem,
// 	destination: string
// ): AsyncIterableIterator<[string, number, number]> {
// 	const fsPool: FileSystemPool<FileSystem> = fsSource instanceof FileSystemPool ? fsSource : new FileSystemPool([fsSource]);
// 	const files: [string, Stats][] = [];
// 	yield* fsPool.iterate(lstree(fsPool, source), async ([src, stat], fs) => {
// 		if (stat.isFile) {
// 			files.push([src, stat]);
// 		} else {
// 			await fsDestination.createDirectory(src, true);
// 		}
// 		return [src, -1, -1] as [string, number, number];
// 	});

// 	const totalSize = files.reduce((total, entry) => total + entry[1].size, 0);
// 	let size = 0;

// 	yield* fsPool.iterate(files[Symbol.iterator](), async function* ([src, stat], fs) {
// 		const dst = src;
// 		const readStream = await fs.createReadStream(src);
// 		const writeStream = await fsDestination.createWriteStream(dst);

// 		readStream.pipe(writeStream);

// 		for await (const chunk of readStream) {
// 			size += chunk.length;
// 			yield [src, size, totalSize] as [string, number, number];
// 		}
// 		return [src, size, totalSize] as [string, number, number];
// 	});
// }