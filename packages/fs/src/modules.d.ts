declare module "parse-listing" {
	export function parseEntries(content: string, callback: (err: Error, entries: { name: string, type: number, size: string, time: string }[]) => void): void
}

declare module "node-sftp-server";