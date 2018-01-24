import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { spawn, ChildProcess } from 'child_process';
import { RedisMockDriver } from './RedisMockDriver';

describe('RedisMock', () => {

	const driver: RedisMockDriver = new RedisMockDriver();
	
	it('test', async () => {
		
		console.log(await driver.has('test'));
		console.log(await driver.set('test', 'Bleh', 600));
		console.log(await driver.has('test'));
		console.log(await driver.get('test'));
		console.log(await driver.unset('test'));
		console.log(await driver.has('test'));
	})

})