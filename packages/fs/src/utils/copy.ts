import { Stats, FileSystem } from "../FileSystem";
import { dirname } from "path";


export async function copy(fsSource: FileSystem | FileSystem[], source: string, fsDestination: FileSystem | FileSystem[], destination: string): Promise<void> {
	const fss = fsSource instanceof FileSystem ? [fsSource] : fsSource;
	const fsd = fsDestination instanceof FileSystem ? [fsDestination] : fsDestination;

	// TODO: Load balance connections

	const stat = await fss[0].stat(source);
	if (stat.isFile) {
		const readStream = await fss[0].createReadStream(source);
		const writeStream = await fsd[0].createWriteStream(destination);
		await new Promise((resolve, reject) => {
			writeStream.on('finish', resolve);
			writeStream.on('error', reject);
			readStream.pipe(writeStream);
		});
	} else {
		const tree = await readDirectoryRecursive(fss[0], source);
		let first = true;
		for (const [path, stat] of tree) {
			if (first) {
				first = false;
				await fsd[0].createDirectory(dirname(path), true);
			}
			if (stat.isFile) {
				await copy(fss, path, fsd, path);
			}
			else if (stat.isDirectory) {
				await fsd[0].createDirectory(path, true);
			}
		}
	}
}

async function readDirectoryRecursive(fs: FileSystem, path: string): Promise<[string, Stats][]> {
	const entries = await fs.readDirectory(path, true);

	entries.forEach(entry => {
		entry[0] = path + '/' + entry[0]
	});

	for (const [fullPath, stat] of entries) {
		if (stat.isFile === false) {
			entries.push(...(await readDirectoryRecursive(fs, fullPath)));
		}
	}

	return entries;
}