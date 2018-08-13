import 'mocha';
import { use, should } from 'chai';
use(require("chai-as-promised"));
should();
import { LocalFileSystem } from '../FileSystemLocal';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { copy } from './copy';

describe('copy', () => {

	const tmpA = mkdtempSync(join(tmpdir(), 'konstellio-copyA-'));
	const tmpB = mkdtempSync(join(tmpdir(), 'konstellio-copyB-'));
	const fsA = new LocalFileSystem(tmpA);
	const fsB = new LocalFileSystem(tmpB);

	before(() => {
		mkdirSync(join(tmpA, 'Griffin'));
		writeFileSync(join(tmpA, 'Griffin/Peter.txt'), 'Peter Griffin');
		writeFileSync(join(tmpA, 'Griffin/Lois.txt'), 'Lois Pewterachmidt');
		writeFileSync(join(tmpA, 'Griffin/Stewie.txt'), 'Stewie Griffin');
		mkdirSync(join(tmpA, 'Griffin/SubFolder'));
		writeFileSync(join(tmpA, 'Griffin/SubFolder/A.txt'), 'A');
		writeFileSync(join(tmpA, 'Griffin/SubFolder/B.txt'), 'B');
		writeFileSync(join(tmpA, 'Griffin/SubFolder/D.txt'), 'D');
	});
	
	it('copy file', async () => {
		await copy(fsA, 'Griffin/Peter.txt', fsB, 'Peter.txt');
	});

	it('copy directory', async () => {
		await copy(fsA, 'Griffin', fsB, 'Family-Guys');
	});

});