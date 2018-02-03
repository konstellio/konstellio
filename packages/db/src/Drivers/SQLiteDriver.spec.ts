import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { spawn, ChildProcess } from 'child_process';
import { SQLiteDriver } from './SQLiteDriver';
import { q, QueryNotSupportedError } from '../Query';
import * as QueryResult from '../QueryResult';
import { ColumnType } from '../index';

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

		driver.connect()
		.then(() => driver.execute('CREATE TABLE Bar_Foo (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, postDate TEXT, likes INTEGER)'))
		.then(() => driver.execute('CREATE INDEX Bar_Foo_postDate ON Bar_Foo (postDate ASC, likes ASC)'))
		.then(() => driver.execute('CREATE INDEX Bar_Foo_title ON Bar_Foo (title ASC)'))
		.then(() => done()).catch(done);
	});

	it('insert', () => {

		const insert = q.insert('Foo', 'Bar').fields({
			title: 'Hello world',
			postDate: new Date(),
			likes: 10
		});

		return driver.execute<Foo>(insert).should.be.fulfilled.and.eventually.be.an.instanceOf(QueryResult.InsertQueryResult);
	});

	it('update', () => {

		const update = q.update('Foo', 'Bar').fields({ likes: 11 }).eq('title', 'Hello world').limit(1);

		return driver.execute<Foo>(update).should.be.fulfilled.and.eventually.be.an.instanceOf(QueryResult.UpdateQueryResult);
	});

	it('replace', () => {

		const replace = q.replace('Foo', 'Bar').fields({ title: 'Goodbye world', likes: 11 }).eq('title', 'Hello world').limit(1);

		return driver.execute<Foo>(replace).should.be.rejectedWith(QueryNotSupportedError);
	});

	it('select', () => {

		const select = q.select().from('Foo', 'Bar').limit(1);

		return driver.execute<Foo>(select).should.be.fulfilled.and.eventually.be.an.instanceOf(QueryResult.SelectQueryResult);
	});

	it('delete', () => {

		const remove = q.delete('Foo', 'Bar').eq('title', 'Hello world').limit(1);

		return driver.execute(remove).should.be.fulfilled.and.eventually.be.an.instanceOf(QueryResult.DeleteQueryResult);
	});

	it('describe collection', () => {

		const describe = q.describeCollection('Foo', 'Bar');

		return driver.execute(describe).should.be.fulfilled.and.eventually.be.an.instanceOf(QueryResult.DescribeCollectionQueryResult);
	});

	// it('create collection', () => {

	// 	const create = q.createCollection('Moo', 'Joo').columns(
	// 		q.column('id', ColumnType.UInt64, null, true),
	// 		q.column('title', ColumnType.String),
	// 		q.column('date', ColumnType.Date)
	// 	);

	// 	return driver.execute(create).should.be.fulfilled.and.eventually.be.an.instanceOf(QueryResult.CreateCollectionQueryResult);
	// });

});