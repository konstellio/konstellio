import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { spawn, ChildProcess } from 'child_process';
import { SQLiteDriver } from './SQLiteDriver';
import { q } from '../Query';
import { InsertQueryResult, UpdateQueryResult } from '../QueryResult';

describe('SQLite', () => {

	type Foo = {
		title: string
		postDate: Date
		likes: number
	}

	let driver: SQLiteDriver;

	before(function (done) {
		this.timeout(10000);

		driver = new SQLiteDriver({
			filename: ':memory:'
		});

		driver.connect().then(() => done()).catch(done);
	});

	it('insert', () => {

		const insert = q.insert('Foo', 'Bar').fields({
			title: 'Hello world',
			postDate: new Date(),
			likes: 10
		});

		return driver.execute<Foo>(insert).should.be.fulfilled.and.eventually.be.an.instanceOf(InsertQueryResult);
	});

});