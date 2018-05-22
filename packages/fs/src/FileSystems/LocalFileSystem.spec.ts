import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { LocalFileSystem } from './LocalFileSystem';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { driverShouldBehaveLikeAFileSystem } from '../FileSystem.spec';

describe('Local', () => {

	const tmp = mkdtempSync(join(tmpdir(), 'konstellio-'));
	const driver: LocalFileSystem = new LocalFileSystem(tmp);

	before(() => {
		mkdirSync(join(tmp, 'Griffin'));
		writeFileSync(join(tmp, 'Griffin/Peter.txt'), 'Peter Griffin');
		writeFileSync(join(tmp, 'Griffin/Lois.txt'), 'Lois Pewterachmidt');
		writeFileSync(join(tmp, 'Griffin/Stewie.txt'), 'Stewie Griffin');
	});
	
	driverShouldBehaveLikeAFileSystem(driver);

})