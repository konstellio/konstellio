import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { FileSystemLocal } from '../../src/FileSystemLocal';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { lstree } from '@konstellio/fs';

describe('lstree', () => {

	const tmpA = mkdtempSync(join(tmpdir(), 'konstellio-'));
	const fsA = new FileSystemLocal(tmpA);

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

	it('list tree', async () => {

		const entries = [] as any[];
		for await (const entry of lstree(fsA, '.')) {
			entries.push(entry);
		}

		expect(entries[0][0]).to.equal('./Griffin');
		expect(entries[0][1].isDirectory).to.equal(true);
		expect(entries[0][1].size).to.equal(0);
		expect(entries[1][0]).to.equal('./Griffin/Lois.txt');
		expect(entries[1][1].isFile).to.equal(true);
		expect(entries[1][1].size).to.equal(18);
		expect(entries[2][0]).to.equal('./Griffin/Peter.txt');
		expect(entries[2][1].isFile).to.equal(true);
		expect(entries[2][1].size).to.equal(13);
		expect(entries[3][0]).to.equal('./Griffin/Stewie.txt');
		expect(entries[3][1].isFile).to.equal(true);
		expect(entries[3][1].size).to.equal(14);
		expect(entries[4][0]).to.equal('./Griffin/SubFolder');
		expect(entries[4][1].isDirectory).to.equal(true);
		expect(entries[4][1].size).to.equal(0);
		expect(entries[5][0]).to.equal('./Griffin/SubFolder/A.txt');
		expect(entries[5][1].isFile).to.equal(true);
		expect(entries[5][1].size).to.equal(1);
		expect(entries[6][0]).to.equal('./Griffin/SubFolder/B.txt');
		expect(entries[6][1].isFile).to.equal(true);
		expect(entries[6][1].size).to.equal(1);
		expect(entries[7][0]).to.equal('./Griffin/SubFolder/D.txt');
		expect(entries[7][1].isFile).to.equal(true);
		expect(entries[7][1].size).to.equal(1);
	});

});