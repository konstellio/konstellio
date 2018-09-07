import { FileSystem, Stats } from "../FileSystem";
import { Readable } from "stream";

export function lstree(fs: FileSystem, path: string) {
	const pathToList = [path];
	let first = true;
	return new Readable({
		objectMode: true,
		highWaterMark: 1,
		async read() {
			if (first) {
				const stat = await fs.stat(path);
				this.push([path, stat]);
				if (stat.isFile) {
					this.push(null);
				}
				first = false;
				return;
			}

			if (pathToList.length === 0) {
				this.push(null);
			} else {
				const path = pathToList.shift()!;
				const pathEntries = await fs.readDirectory(path, true);
				for (const entry of pathEntries) {
					entry[0] = `${path}/${entry[0]}`;
					this.push(entry);
					if (!entry[1].isFile) {
						pathToList.push(entry[0]);
					}
				}
			}
		}
	});
}