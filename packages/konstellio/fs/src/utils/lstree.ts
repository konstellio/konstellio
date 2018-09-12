import { FileSystem, Stats } from "../FileSystem";
import { Readable } from "stream";

export function lstree(fs: FileSystem, path: string) {
	const queue: [string, Stats][] = [];
	let first = true;
	return new Readable({
		objectMode: true,
		highWaterMark: 1,
		read(size) {
			if (first) {
				fs.stat(path)
				.then(stat => {
					first = false;
					if (stat.isFile) {
						this.push([path, stat]);
					} else {
						queue.push([path, stat]);
						processQueue(this);
					}
				})
				.catch(err => {
					this.emit('error', err);
				});
			}
			else if (queue.length === 0) {
				this.push(null);
			}
			else {
				processQueue(this);
			}
		}
	});
	function processQueue(stream: Readable) {
		const [path, stat] = queue.shift()!;
		if (stat.isFile) {
			stream.push([path, stat]);
		} else {
			fs.readDirectory(path, true)
			.then(entries => {
				for (const entry of entries) {
					entry[0] = `${path}/${entry[0]}`;
					queue.push(entry);
				}
				stream.push([path, stat]);
			})
			.catch(err => {
				stream.emit('error', err);
			});
		}
	}
}