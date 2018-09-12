import { FileSystem, Stats } from "../FileSystem";
import { Readable } from "stream";

export function lstree(fs: FileSystem, path: string) {
	const directories = [path];
	let first = true;
	let abort = false;
	return new Readable({
		objectMode: true,
		highWaterMark: 1,
		read(size) {
			if (abort) {
				return this.push(null);
			}
			if (first) {
				fs.stat(path)
				.then(stat => {
					first = false;
					if (stat.isFile) {
						abort = true;
					}
					this.push([path, stat]);
				})
				.catch(err => {
					abort = true;
					this.emit('error', err);
				});
			}
			else if (directories.length === 0) {
				this.push(null);
			}
			else {
				const path = directories.shift()!;
				fs.readDirectory(path, true)
				.then(entries => {
					for (const entry of entries) {
						entry[0] = `${path}/${entry[0]}`;
						if (!entry[1].isFile) {
							directories.push(entry[0]);
						}
						this.push(entry);
					}
				})
				.catch(err => {
					abort = true;
					this.emit('error', err);
				});
			}
		}
	});
}