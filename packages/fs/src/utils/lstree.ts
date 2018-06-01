import { FileSystem, Stats } from "../FileSystem";


export async function lstree(fs: FileSystem, path: string): Promise<[string, Stats][]> {
	const entries = await fs.readDirectory(path, true);

	entries.forEach(entry => {
		entry[0] = path + '/' + entry[0]
	});

	for (const [fullPath, stat] of entries) {
		if (stat.isFile === false) {
			entries.push(...(await lstree(fs, fullPath)));
		}
	}

	return entries;
}