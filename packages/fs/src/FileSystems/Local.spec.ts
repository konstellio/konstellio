import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { LocalFileSystem } from './Local';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { shouldBehaveLikeAFileSystem } from '../FileSystem.spec';

describe('Local', () => {

	const tmp = mkdtempSync(join(tmpdir(), 'konstellio-local-'));
	const fs = new LocalFileSystem(tmp);

	before(() => {
		mkdirSync(join(tmp, 'Griffin'));
		writeFileSync(join(tmp, 'Griffin/Peter.txt'), 'Peter Griffin');
		writeFileSync(join(tmp, 'Griffin/Lois.txt'), 'Lois Pewterachmidt');
		writeFileSync(join(tmp, 'Griffin/Stewie.txt'), 'Stewie Griffin');
	});
	
	shouldBehaveLikeAFileSystem(fs);

})