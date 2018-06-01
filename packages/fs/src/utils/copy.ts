import { FileSystem } from "../FileSystem";
import { dirname } from "path";
import { lstree } from "./lstree";


export async function copy(fsSource: FileSystem, source: string, fsDestination: FileSystem, destination: string): Promise<void> {
	const stat = await fsSource.stat(source);
	if (stat.isFile) {
		// TODO: Progression
		const readStream = await fsSource.createReadStream(source);
		const writeStream = await fsDestination.createWriteStream(destination);
		await new Promise((resolve, reject) => {
			writeStream.on('finish', resolve);
			writeStream.on('error', reject);
			readStream.pipe(writeStream);
		});
	} else {
		const tree = await lstree(fsSource, source);
		let first = true;
		for (const [path, stat] of tree) {
			if (first) {
				first = false;
				await fsDestination.createDirectory(dirname(path), true);
			}
			if (stat.isFile) {
				await copy(fsSource, path, fsDestination, path);
			}
			else if (stat.isDirectory) {
				await fsDestination.createDirectory(path, true);
			}
		}
	}
}