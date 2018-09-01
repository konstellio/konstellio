import { FileSystem, Stats } from "../FileSystem";

export async function* lstree(fs: FileSystem, path: string): AsyncIterableIterator<[string, Stats]> {
	const pathToList = [path];

	while (pathToList.length > 0) {
		const path = pathToList.shift()!;
		const pathEntries = await fs.readDirectory(path, true);
		for (const entry of pathEntries) {
			entry[0] = `${path}/${entry[0]}`;
			yield entry;
			if (!entry[1].isFile) {
				pathToList.push(entry[0]);
			}
		}
	}
}