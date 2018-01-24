import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { spawn, ChildProcess } from 'child_process';
import { LocalDriver } from './LocalDriver';

describe('Local', () => {

	const driver: LocalDriver = new LocalDriver(__dirname + '/..');
	
	it('test', async () => {
		
		// const f1 = driver.getFile('LocalDriver.spec.ts');
		// const f2 = driver.getFile('foo/bar/moo.txt');
		// const f3 = driver.getFile('foo/bar/boo.txt');
		// console.log(f1.fullPath);
		// console.log(f2.fullPath, f3.fullPath);
		// console.log(f2.parent === f3.parent);
		// console.log(await f1.exists());
		// console.log(await f1.stat());

		// const d1 = driver.getDirectory('Bleh');
		// console.log(d1.fullPath, d1.realPath);
		// // console.log(await d1.create());
		// console.log(await d1.exists());
		// // console.log(await d1.unlink());

		// const d2 = d1.getDirectory('test/../');
		// console.log(d2.fullPath, d2.realPath);
		// console.log(d2 === d1);

		// // const d3 = d1.getDirectory('test/../../..');
		// // console.log(d3.realPath);

		// const f4 = d1.getFile('mleh.txt');
		// console.log(f4.realPath);
		// console.log(await f4.exists());

		const d1 = driver.getDirectory('./');
		
		const dir = await d1.readdir();
		console.log(dir);

	})

})