import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { LocalDriver } from './LocalDriver';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { driverShouldBehaveLikeAFileSystem } from '../Driver.spec';

describe('Local', () => {

	const tmp = mkdtempSync(join(tmpdir(), 'konstellio-'));
	const driver: LocalDriver = new LocalDriver(tmp);

	before(() => {
		mkdirSync(join(tmp, 'Griffin'));
		writeFileSync(join(tmp, 'Griffin/Peter.txt'), 'Peter Griffin');
		writeFileSync(join(tmp, 'Griffin/Lois.txt'), 'Lois Pewterachmidt');
		writeFileSync(join(tmp, 'Griffin/Stewie.txt'), 'Stewie Griffin');
	});
	
	driverShouldBehaveLikeAFileSystem(driver);

})