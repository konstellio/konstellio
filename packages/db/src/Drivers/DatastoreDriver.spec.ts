// import 'mocha';
// import { use, expect, should } from 'chai';
// use(require("chai-as-promised"));
// should();
// import { spawn, ChildProcess } from 'child_process';
// import { DatastoreDriver } from './DatastoreDriver';
// import { q } from '../Query';
// import { InsertQueryResult, UpdateQueryResult } from '../QueryResult';

// describe('Datastore', () => {

// 	type Foo = {
// 		title: string
// 		postDate: Date
// 		likes: number
// 	}

// 	let driver: DatastoreDriver;

// 	before(function (done) {
// 		this.timeout(10000);

// 		driver = new DatastoreDriver({
// 			projectId: 'test',
// 			apiEndpoint: 'http://localhost:8504'
// 		});

// 		// Spin up Datastore container
// 		const container = spawn('docker', 'run --rm --name konstellio-datastore --publish 8504:8504 google/cloud-sdk gcloud beta emulators datastore start --project=konstellio --host-port=0.0.0.0:8504'.split(' '));
// 		container.stderr.on('data', (chunk) => {
// 			const data = `${chunk}`;
// 			if (data.indexOf('Dev App Server is now running.') > -1) {
// 				driver.connect().then(() => done()).catch(done);
// 			}
// 		});
// 	});

// 	after((done) => {
// 		// Kill Datastore container
// 		spawn('docker', 'kill -s SIGKILL konstellio-datastore'.split(' '));
// 		setTimeout(done, 1500);
// 	});

// 	it('insert', () => {

// 		const insert = q.insert('Foo', 'Bar').fields({
// 			title: 'Hello world',
// 			postDate: new Date(),
// 			likes: 10
// 		});

// 		return driver.execute<Foo>(insert).should.be.fulfilled.and.eventually.be.an.instanceOf(InsertQueryResult);
// 	});

// 	// it('update', () => {

// 	// 	const update = q.update('Foo', 'Bar').fields({
// 	// 		title: 'Hello World'
// 	// 	}).eq('id', 7).limit(1);

// 	// 	return driver.execute<Foo>(update).should.be.fulfilled.and.eventually.be.an.instanceOf(UpdateQueryResult);

// 	// })

// });