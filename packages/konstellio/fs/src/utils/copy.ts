import { FileSystem, Stats, FileSystemPool } from "../FileSystem";
import { relative, join, sep } from "path";
import { lstree } from "./lstree";
import { Transform } from "stream";

export function copy(
	fsSource: FileSystem,
	source: string,
	fsDestination: FileSystem,
	destination: string
) {
	if (fsSource === fsDestination && !(fsSource instanceof FileSystemPool)) {
		throw new Error(`You should probably be using fsSource.copy() instead.`);
	}

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
		transform(entry, encoding, done) {
			if (entry[2].isFile) {
				files.push(entry);
				totalSize += entry[2].size;
				done();
			} else {
				fsDestination.createDirectory(entry[1], true).then(() => done(), done);
			}
		},
		flush(done) {
			for (const file of files) {
				this.push(file);
			}
			done();
		}
	});
	
	const copyFiles = fsSource instanceof FileSystemPool
		? fsSource.pool.transform({
			objectMode: true,
			highWaterMark: 1,
		}, async (entry, fs, push) => {
			const readStream = await fs.createReadStream(entry[0]);
			const writeStream = await fsDestination.createWriteStream(entry[1]);

			await new Promise((resolve, reject) => {
				writeStream.on('close', resolve);
				writeStream.on('error', reject);
				readStream.on('data', (chunk: any) => {
					transferedSize += chunk.length;
					push([...entry, transferedSize, totalSize]);
				});
				readStream.pipe(writeStream);
			});
		})
		: new Transform({
			objectMode: true,
			highWaterMark: 1,
			transform(entry, encoding, done) {
				Promise.all([
					fsSource.createReadStream(entry[0]),
					fsDestination.createWriteStream(entry[1], true)
				])
				.then(([readStream, writeStream]) => {
					writeStream.on('close', done);
					writeStream.on('error', done);
					readStream.on('data', chunk => {
						transferedSize += chunk.length;
						this.push([...entry, transferedSize, totalSize]);
					});
					readStream.pipe(writeStream);
				});
			}
		});
	return lstree(fsSource, source).pipe(mapDestination).pipe(createDirectories).pipe(copyFiles);
}