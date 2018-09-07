import { FileSystem, Stats, FileSystemPool } from "../FileSystem";
import { relative, join, sep } from "path";
import { lstree } from "./lstree";
import { Transform } from "stream";

export function copy(
	fsSource: FileSystem | FileSystemPool,
	source: string,
	fsDestination: FileSystem | FileSystemPool,
	destination: string
) {
	const files: [string, string, Stats][] = [];
	let totalSize = 0;
	let transferedSize = 0;

	const mapDestination = new Transform({
		objectMode: true,
		highWaterMark: 1,
		transform(entry, encoding, done) {
			done(undefined, [entry[0], join(destination, relative(source, entry[0])).split(sep).join('/'), entry[1]]);
		}
	});
	const createDirectories = new Transform({
		objectMode: true,
		highWaterMark: 1,
		async transform(entry, encoding, done) {
			if (entry[2].isFile) {
				files.push(entry);
				totalSize += entry[2].size;
			} else {
				await fsDestination.createDirectory(entry[1], true);
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
	// TODO if both FileSystemPool, make copy parallel. Inspired by https://www.npmjs.com/package/parallel-transform
	const copyFiles = new Transform({
		objectMode: true,
		highWaterMark: 1,
		async transform(entry, encoding, done) {
			const readStream = await fsSource.createReadStream(entry[0]);
			const writeStream = await fsDestination.createWriteStream(entry[1]);

			readStream.on('end', done);
			readStream.on('data', chunk => {
				transferedSize += chunk.length;
				this.push([...entry, transferedSize, totalSize]);
			});
			readStream.on('error', done);
			readStream.pipe(writeStream);
		}
	});
	return lstree(fsSource, source).pipe(mapDestination).pipe(createDirectories).pipe(copyFiles);
}