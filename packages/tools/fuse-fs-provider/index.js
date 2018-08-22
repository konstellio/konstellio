const fuse = require('fuse-bindings');
const { FileSystemFTP } = require('@konstellio/fs-ftp');
const { constants } = require('fs');

const fs = new FileSystemFTP({
	// ...
});

const mountPath = 'N:\\';

const dirCache = new Map();
const statCache = new Map();

const S_IRUSR = 256;    /* 0000400 read permission, owner */
const S_IWUSR = 128;    /* 0000200 write permission, owner */
const S_IXUSR = 64;     /* 0000100 execute/search permission, owner */
const S_IRGRP = 32;     /* 0000040 read permission, group */
const S_IWGRP = 16;     /* 0000020 write permission, group */
const S_IXGRP = 8;      /* 0000010 execute/search permission, group */
const S_IROTH = 4;      /* 0000004 read permission, others */
const S_IWOTH = 2;      /* 0000002 write permission, others */
const S_IXOTH = 1;      /* 0000001 execute/search permission, others */

const dummyPerms = (S_IRUSR | S_IWUSR | S_IXUSR | S_IRGRP | S_IXGRP | S_IROTH | S_IXOTH);

function convertStat(stat) {
	return {
		mtime: stat.mtime,
		atime: stat.atime,
		ctime: stat.ctime,
		nlink: 1,
		size: stat.size,
		mode: (
			(constants.S_IFREG << (stat.isFile ? 0 : -1)) |
			(constants.S_IFDIR << (stat.isDirectory ? 0 : -1)) |
			(constants.S_IFLNK << (stat.isSymbolicLink ? 0 : -1))
		) | dummyPerms,
		uid: process.getuid ? process.getuid() : 0,
		gid: process.getgid ? process.getgid() : 0
	};
}

fuse.mount(
	mountPath,
	{
		async readdir(path, callback) {
			try {
				if (!dirCache.has(path)) {
					console.log('readdir(%s)', path);
					const entries = await fs.readDirectory(path, true);
					dirCache.set(path, entries.map(([name]) => name));
					for (const [name, stat] of entries) {
						statCache.set(path.replace(/\/$/, '') + '/' + name, convertStat(stat));
					}
				}
				callback(0, dirCache.get(path));
			} catch (err) {
				callback(0);
			}
		},
		async getattr(path, callback) {
			try {
				if (!statCache.has(path)) {
					console.log('getattr(%s)', path);
					const stat = await fs.stat(path);
					statCache.set(path, convertStat(stat));
				}
				callback(0, statCache.get(path));
			} catch (err) {
				console.error(err);
				callback(fuse.ENOENT);
			}
		},
		open(path, flags, callback) {
			console.log('open(%s, %d)', path, flags);
			callback(0, 42);
		},
		read(path, fd, buffer, len, pos, callback) {
			console.log('read(%s, %d, %d, %d)', path, fd, len, pos);
			callback(0);
		}
	},
	function (err) {
		if (err) throw err;
		console.log(`Filesystem mounted on ${mountPath}`)
	}
);

process.on('SIGINT', function () {
	fuse.unmount(mountPath, function (err) {
		if (err) {
			console.log('filesystem at ' + mountPath + ' not unmounted', err.message);
		} else {
			console.log('filesystem at ' + mountPath + ' unmounted');
		}
	});
});