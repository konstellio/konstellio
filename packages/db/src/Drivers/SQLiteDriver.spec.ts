import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { spawn, ChildProcess } from 'child_process';
import { SQLiteDriver } from './SQLiteDriver';
import { q, QueryNotSupportedError } from '../Query';
import * as QueryResult from '../QueryResult';
import { ColumnType, IndexType } from '../index';
import { unlinkSync } from 'fs';

describe('SQLite', () => {

	type Foo = {
		title: string
		postDate: Date
		likes: number
	}

	let driver: SQLiteDriver;

	before(function (done) {
		this.timeout(10000);

		// unlinkSync('./kdb.sqlite');

		driver = new SQLiteDriver({
			filename: ':memory:'
			// filename: './kdb.sqlite'
		});

		driver.connect()
		.then(() => driver.execute('CREATE TABLE Bar_Foo (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, postDate TEXT, likes INTEGER)'))
		.then(() => driver.execute('CREATE INDEX Bar_Foo_postDate ON Bar_Foo (postDate ASC, likes ASC)'))
		.then(() => driver.execute('CREATE INDEX Bar_Foo_title ON Bar_Foo (title ASC)'))
		.then(() => done()).catch(done);
	});

	it('insert', async () => {

		const result: QueryResult.InsertQueryResult = await driver.execute(q.insert('Foo', 'Bar').object({
			title: 'Hello world',
			postDate: new Date(),
			likes: 10
		})).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.InsertQueryResult);

		await driver.execute(q.insert('Foo', 'Bar').object({
			title: 'Bye world',
			postDate: new Date(),
			likes: 10
		})).should.be.fulfilled;
	});

	it('update', async () => {

		const update = q.update('Foo', 'Bar').fields({ likes: 11 }).eq('title', 'Hello world');//.limit(1);

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

	it('variable', async () => {
		const select = q.select().from('Foo', 'Bar').eq('title', q.var('title'));
		await driver.execute<Foo>(select).should.be.rejected;

		const result: QueryResult.SelectQueryResult<any> = await driver.execute<Foo>(select, { title: 'Hello world' }).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.SelectQueryResult);
	});

	it('delete', async () => {

		const remove = q.delete('Foo', 'Bar').eq('title', 'Hello world');//.limit(1);

		const result: QueryResult.DeleteQueryResult = await driver.execute(remove).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.DeleteQueryResult);
	});

	it('describe collection', async () => {

		const desc: QueryResult.DescribeCollectionQueryResult = await driver.execute(q.describeCollection('Foo', 'Bar')).should.be.fulfilled;
		expect(desc).to.be.an.instanceOf(QueryResult.DescribeCollectionQueryResult);
		expect(desc.columns.length).to.be.equal(4);
		expect(desc.columns[0].getName()).to.be.equal('id');
		expect(desc.columns[0].getType()).to.be.equal(ColumnType.Int64);
		expect(desc.columns[0].getDefaultValue()).to.be.equal(null);
		expect(desc.columns[0].getAutoIncrement()).to.be.equal(true);
		expect(desc.columns[1].getName()).to.be.equal('title');
		expect(desc.columns[1].getType()).to.be.equal(ColumnType.Text);
		expect(desc.columns[1].getDefaultValue()).to.be.equal(null);
		expect(desc.columns[1].getAutoIncrement()).to.be.equal(false);
		expect(desc.columns[2].getName()).to.be.equal('postDate');
		expect(desc.columns[2].getType()).to.be.equal(ColumnType.Text);
		expect(desc.columns[2].getDefaultValue()).to.be.equal(null);
		expect(desc.columns[2].getAutoIncrement()).to.be.equal(false);
		expect(desc.columns[3].getName()).to.be.equal('likes');
		expect(desc.columns[3].getType()).to.be.equal(ColumnType.Int64);
		expect(desc.columns[3].getDefaultValue()).to.be.equal(null);
		expect(desc.columns[3].getAutoIncrement()).to.be.equal(false);
		expect(desc.indexes.length).to.be.equal(3);
		expect(desc.indexes[0].getName()).to.be.equal('Bar_Foo_id');
		expect(desc.indexes[0].getType()).to.be.equal(IndexType.Primary);
		expect(desc.indexes[0].getColumns()!.count()).to.be.equal(1);
		expect(desc.indexes[0].getColumns()!.get(0).toString()).to.be.equal('id asc');
		expect(desc.indexes[1].getName()).to.be.equal('Bar_Foo_title');
		expect(desc.indexes[1].getType()).to.be.equal(IndexType.Index);
		expect(desc.indexes[1].getColumns()!.count()).to.be.equal(1);
		expect(desc.indexes[1].getColumns()!.get(0).toString()).to.be.equal('title asc');
		expect(desc.indexes[2].getName()).to.be.equal('Bar_Foo_postDate');
		expect(desc.indexes[2].getType()).to.be.equal(IndexType.Index);
		expect(desc.indexes[2].getColumns()!.count()).to.be.equal(2);
		expect(desc.indexes[2].getColumns()!.get(0).toString()).to.be.equal('postDate asc');
		expect(desc.indexes[2].getColumns()!.get(1).toString()).to.be.equal('likes asc');
	});

	it('create collection', async () => {

		const create = q.createCollection('Moo', 'Joo')
			.columns(
				q.column('id', ColumnType.UInt64, null, true),
				q.column('title', ColumnType.Text),
				q.column('date', ColumnType.Date)
			)
			.indexes(
				q.index('Joo_Moo_id', IndexType.Primary).columns(q.sort(q.field('id'), 'asc')),
				q.index('Joo_Moo_date', IndexType.Unique).columns(q.sort(q.field('id'), 'asc'), q.sort(q.field('date'), 'desc'))
			)

		const result: QueryResult.CreateCollectionQueryResult = await driver.execute(create).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.CreateCollectionQueryResult);

		const desc: QueryResult.DescribeCollectionQueryResult = await driver.execute(q.describeCollection('Moo', 'Joo')).should.be.fulfilled;
		expect(desc.columns.length).to.be.equal(3);
		expect(desc.columns[0].getName()).to.be.equal('id');
		expect(desc.columns[0].getType()).to.be.equal(ColumnType.Int64);
		expect(desc.columns[0].getDefaultValue()).to.be.equal(null);
		expect(desc.columns[0].getAutoIncrement()).to.be.equal(true);
		expect(desc.columns[1].getName()).to.be.equal('title');
		expect(desc.columns[1].getType()).to.be.equal(ColumnType.Text);
		expect(desc.columns[1].getDefaultValue()).to.be.equal(null);
		expect(desc.columns[1].getAutoIncrement()).to.be.equal(false);
		expect(desc.columns[2].getName()).to.be.equal('date');
		expect(desc.columns[2].getType()).to.be.equal(ColumnType.Text);
		expect(desc.columns[2].getDefaultValue()).to.be.equal(null);
		expect(desc.columns[2].getAutoIncrement()).to.be.equal(false);
		expect(desc.indexes.length).to.be.equal(2);
		expect(desc.indexes[0].getName()).to.be.equal('Joo_Moo_id');
		expect(desc.indexes[0].getType()).to.be.equal(IndexType.Primary);
		expect(desc.indexes[0].getColumns()!.count()).to.be.equal(1);
		expect(desc.indexes[0].getColumns()!.get(0).toString()).to.be.equal('id asc');
		expect(desc.indexes[1].getName()).to.be.equal('Joo_Moo_date');
		expect(desc.indexes[1].getType()).to.be.equal(IndexType.Unique);
		expect(desc.indexes[1].getColumns()!.count()).to.be.equal(2);
		expect(desc.indexes[1].getColumns()!.get(0).toString()).to.be.equal('id asc');
		expect(desc.indexes[1].getColumns()!.get(1).toString()).to.be.equal('date desc');
	});

	it('alter collection', async () => {

		const alter = q.alterCollection('Moo', 'Joo')
			.addColumn(q.column('content', ColumnType.Text))
			.alterColumn('date', q.column('postDate', ColumnType.Date))
			.dropColumn('title')
			.addIndex(q.index('Joo_Moo_content', IndexType.Index).columns(q.sort(q.field('content'), 'asc')))
			.dropIndex('Joo_Moo_date')
			.rename('Moo', 'Boo');

		const result: QueryResult.AlterCollectionQueryResult = await driver.execute(alter).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.AlterCollectionQueryResult);

		const desc: QueryResult.DescribeCollectionQueryResult = await driver.execute(q.describeCollection('Moo', 'Boo')).should.be.fulfilled;
		expect(desc.columns.length).to.be.equal(3);
		expect(desc.columns[0].getName()).to.be.equal('id');
		expect(desc.columns[0].getType()).to.be.equal(ColumnType.Int64);
		expect(desc.columns[0].getDefaultValue()).to.be.equal(null);
		expect(desc.columns[0].getAutoIncrement()).to.be.equal(true);
		expect(desc.columns[1].getName()).to.be.equal('postDate');
		expect(desc.columns[1].getType()).to.be.equal(ColumnType.Text);
		expect(desc.columns[1].getDefaultValue()).to.be.equal(null);
		expect(desc.columns[1].getAutoIncrement()).to.be.equal(false);
		expect(desc.columns[2].getName()).to.be.equal('content');
		expect(desc.columns[2].getType()).to.be.equal(ColumnType.Text);
		expect(desc.columns[2].getDefaultValue()).to.be.equal(null);
		expect(desc.columns[2].getAutoIncrement()).to.be.equal(false);
		expect(desc.indexes.length).to.be.equal(2);
		expect(desc.indexes[0].getName()).to.be.equal('Boo_Moo_id');
		expect(desc.indexes[0].getType()).to.be.equal(IndexType.Primary);
		expect(desc.indexes[0].getColumns()!.count()).to.be.equal(1);
		expect(desc.indexes[0].getColumns()!.get(0).toString()).to.be.equal('id asc');
		expect(desc.indexes[1].getName()).to.be.equal('Joo_Moo_content');
		expect(desc.indexes[1].getType()).to.be.equal(IndexType.Index);
		expect(desc.indexes[1].getColumns()!.count()).to.be.equal(1);
		expect(desc.indexes[1].getColumns()!.get(0).toString()).to.be.equal('content asc');
	});

	it('exists collection', async () => {
		let result: QueryResult.CollectionExistsQueryResult = await driver.execute(q.collectionExists('Moo', 'Boo')).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.CollectionExistsQueryResult);
		expect(result.exists).to.equal(true);

		result = await driver.execute(q.collectionExists('Foo', 'Joo')).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.CollectionExistsQueryResult);
		expect(result.exists).to.equal(false);
	});

	it('describe collection', async () => {

		let result: QueryResult.ShowCollectionQueryResult = await driver.execute(q.showCollection()).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.ShowCollectionQueryResult);
		expect(result.collections.length).to.equal(2);
		expect(result.collections[0].toString()).to.equal('Bar.Foo');
		expect(result.collections[1].toString()).to.equal('Boo.Moo');

	});

	it('drop collection', async () => {
		let result: QueryResult.DropCollectionQueryResult = await driver.execute(q.dropCollection('Moo', 'Boo')).should.be.fulfilled;
		expect(result).to.be.an.instanceOf(QueryResult.DropCollectionQueryResult);
		expect(result.acknowledge).to.equal(true);
	});

});