import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { DatastoreDriver } from './DatastoreDriver';
import { q } from './Query';
import { InsertQueryResult, UpdateQueryResult } from './QueryResult';

describe('Datastore', () => {

	type Foo = {
		title: string
		postDate: Date
		likes: number
	}

	let driver: DatastoreDriver;

	before(done => {

		// Spin up Datastore container
		// https://github.com/konstellio/cloud/blob/google-cloud/script/docker-compose.yml

		driver = new DatastoreDriver({
			projectId: 'test',
			apiEndpoint: 'http://localhost:8504'
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

	it('update', () => {

		const update = q.update('Foo', 'Bar').fields({
			title: 'Hello World'
		}).eq('id', 7).limit(1);

		return driver.execute<Foo>(update).should.be.fulfilled.and.eventually.be.an.instanceOf(UpdateQueryResult);

	})

});