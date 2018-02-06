import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { spawn, ChildProcess } from 'child_process';
import { SQLiteDriver } from './SQLiteDriver';
import { q, QueryNotSupportedError } from '../Query';
import * as QueryResult from '../QueryResult';
import { ColumnType, IndexType } from '../index';

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

	it('insert', async () => {

		const insert = q.insert('Foo', 'Bar').fields({
			title: 'Hello world',
			postDate: new Date(),
			likes: 10
		});

		const result: QueryResult.InsertQueryResult<any> = await driver.execute<Foo>(insert).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.InsertQueryResult);
	});

	it('update', async () => {

		const update = q.update('Foo', 'Bar').fields({ likes: 11 }).eq('title', 'Hello world').limit(1);

		const result: QueryResult.UpdateQueryResult<any> = await driver.execute<Foo>(update).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.UpdateQueryResult);
	});

	it('replace', async () => {

		const replace = q.replace('Foo', 'Bar').fields({ title: 'Goodbye world', likes: 11 }).eq('title', 'Hello world').limit(1);

		await driver.execute<Foo>(replace).should.be.rejectedWith(QueryNotSupportedError);
	});

	it('select', async () => {

		const select = q.select().from('Foo', 'Bar').limit(1);

		const result: QueryResult.SelectQueryResult<any> = await driver.execute<Foo>(select).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.SelectQueryResult);
	});

	it('delete', async () => {

		const remove = q.delete('Foo', 'Bar').eq('title', 'Hello world').limit(1);

		const result: QueryResult.DeleteQueryResult = await driver.execute(remove).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.DeleteQueryResult);
	});

	it('describe collection', async () => {

		const describe = q.describeCollection('Foo', 'Bar');

		const result: QueryResult.DescribeCollectionQueryResult = await driver.execute(describe).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.DescribeCollectionQueryResult);
		expect(result.columns.length).to.be.equal(4);
		expect(result.columns[0].getName()).to.be.equal('id');
		expect(result.columns[0].getType()).to.be.equal(ColumnType.Int64);
		expect(result.columns[0].getDefaultValue()).to.be.equal(null);
		expect(result.columns[0].getAutoIncrement()).to.be.equal(true);
		expect(result.columns[1].getName()).to.be.equal('title');
		expect(result.columns[1].getType()).to.be.equal(ColumnType.String);
		expect(result.columns[1].getDefaultValue()).to.be.equal(null);
		expect(result.columns[1].getAutoIncrement()).to.be.equal(false);
		expect(result.columns[2].getName()).to.be.equal('postDate');
		expect(result.columns[2].getType()).to.be.equal(ColumnType.String);
		expect(result.columns[2].getDefaultValue()).to.be.equal(null);
		expect(result.columns[2].getAutoIncrement()).to.be.equal(false);
		expect(result.columns[3].getName()).to.be.equal('likes');
		expect(result.columns[3].getType()).to.be.equal(ColumnType.Int64);
		expect(result.columns[3].getDefaultValue()).to.be.equal(null);
		expect(result.columns[3].getAutoIncrement()).to.be.equal(false);
		expect(result.indexes.length).to.be.equal(3);
		expect(result.indexes[0].getName()).to.be.equal('Bar_Foo_id');
		expect(result.indexes[0].getType()).to.be.equal(IndexType.Primary);
		expect(result.indexes[0].getColumns()!.count()).to.be.equal(1);
		expect(result.indexes[0].getColumns()!.get(0).name).to.be.equal('id');
		expect(result.indexes[0].getColumns()!.get(0).direction).to.be.equal('asc');
		expect(result.indexes[1].getName()).to.be.equal('Bar_Foo_title');
		expect(result.indexes[1].getType()).to.be.equal(IndexType.Index);
		expect(result.indexes[1].getColumns()!.count()).to.be.equal(1);
		expect(result.indexes[1].getColumns()!.get(0).name).to.be.equal('title');
		expect(result.indexes[1].getColumns()!.get(0).direction).to.be.equal('asc');
		expect(result.indexes[2].getName()).to.be.equal('Bar_Foo_postDate');
		expect(result.indexes[2].getType()).to.be.equal(IndexType.Index);
		expect(result.indexes[2].getColumns()!.count()).to.be.equal(2);
		expect(result.indexes[2].getColumns()!.get(0).name).to.be.equal('postDate');
		expect(result.indexes[2].getColumns()!.get(0).direction).to.be.equal('asc');
		expect(result.indexes[2].getColumns()!.get(1).name).to.be.equal('likes');
		expect(result.indexes[2].getColumns()!.get(1).direction).to.be.equal('asc');
	});

	it('create collection', async () => {

		const create = q.createCollection('Moo', 'Joo').columns(
			q.column('id', ColumnType.UInt64, null, true),
			q.column('title', ColumnType.String),
			q.column('date', ColumnType.Date)
		);

		const result: QueryResult.CreateCollectionQueryResult = await driver.execute(create).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.CreateCollectionQueryResult);
	});

});