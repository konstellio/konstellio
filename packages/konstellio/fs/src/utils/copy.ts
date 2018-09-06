import { FileSystem, Stats } from "../FileSystem";
import { dirname } from "path";
import { lstree } from "./lstree";

// export async function copy(
// 	fsSource: FileSystem,
// 	source: string,
// 	fsDestination: FileSystem,
// 	destination: string
// ) {
// 	const stat = await fsSource.stat(source);
// 	if (stat.isFile) {
// 		const readStream = await fsSource.createReadStream(source);
// 		const writeStream = await fsDestination.createWriteStream(destination);
// 		await new Promise((resolve, reject) => {
// 			writeStream.on('finish', resolve);
// 			writeStream.on('error', reject);
// 			readStream.pipe(writeStream);
// 		});
// 		// yield [source, stat];
// 	} else {
// 		await fsDestination.createDirectory(destination, true);
// 		for await (const [src, stat] of lstree(fsSource, source)) {
// 			const dst = src;
// 			if (stat.isFile) {
// 				await copy(fsSource, src, fsDestination, dst);
// 			}
// 			else if (stat.isDirectory) {
// 				await fsDestination.createDirectory(src, true);
// 			}
// 		}
// 	}
// }

export async function* copy(
	fsSource: FileSystem,
	source: string,
	fsDestination: FileSystem,
	destination: string
): AsyncIterableIterator<[string, number, number]> {
	const stat = await fsSource.stat(source);
	// const stat = await fsSource.stat(source);
	// if (stat.isFile) {
	// 	const readStream = await fsSource.createReadStream(source);
	// 	const writeStream = await fsDestination.createWriteStream(destination);
	// 	await new Promise((resolve, reject) => {
	// 		writeStream.on('finish', resolve);
	// 		writeStream.on('error', reject);
	// 		readStream.pipe(writeStream);
	// 	});
	// 	// yield [source, stat];
	// } else {
	// 	await fsDestination.createDirectory(destination, true);
	// 	for await (const [src, stat] of lstree(fsSource, source)) {
	// 		const dst = src;
	// 		if (stat.isFile) {
	// 			await copy(fsSource, src, fsDestination, dst);
	// 		}
	// 		else if (stat.isDirectory) {
	// 			await fsDestination.createDirectory(src, true);
	// 		}
	// 	}
	// }
}