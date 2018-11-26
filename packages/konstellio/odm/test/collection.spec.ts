import 'mocha';
import { use, should } from 'chai';
use(require("chai-as-promised"));
should();

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Schema, Collection } from '../src/index';
import { DatabaseSQLite } from '@konstellio/db-sqlite';
import { RSA_X931_PADDING } from 'constants';


describe('Collection', () => {

	const postSchema: Schema = {
		handle: 'Post',
		fields: [
			{ handle: 'id', type: 'string' },
			{ handle: 'title', type: 'string', localized: true },
			{ handle: 'slug', type: 'string', localized: true },
			{ handle: 'postDate', type: 'datetime' },
		],
		indexes: [
			{ handle: 'post_id', type: 'primary', fields: [{ handle: 'id' }] },
			{ handle: 'post_slug', type: 'unique', fields: [{ handle: 'slug' }] },
			{ handle: 'post_postDate', type: 'sparse', fields: [{ handle: 'postDate', direction: 'desc' }] }
		]
	};

	interface PostFields {
		id: string;
		title: string;
		slug: string;
		postDate: Date;
	}

	interface PostIndexes {
		id: string;
		slug: string;
		postDate: Date;
	}

	let db: DatabaseSQLite;

	before(function (done) {
		this.timeout(10000);

		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'konstellio-db-sqlite-'));

		db = new DatabaseSQLite({
			filename: ':memory:'
			// filename: join(tmp, 'test.sqlite')
		});

		db.connect()
		.then(() => db.transaction())
		// .then(transaction => {
		// 	transaction.execute('CREATE TABLE Post (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, postDate TEXT, likes INTEGER)');
		// 	transaction.execute('CREATE INDEX Bar_Foo_postDate ON Bar_Foo (postDate ASC, likes ASC)');
		// 	transaction.execute('CREATE INDEX Bar_Foo_title ON Bar_Foo (title ASC)');
		// 	return transaction.commit();
		// })
		.then(() => done());
	});

	// it('initialize', async () => {
	// 	const Post = new Collection<PostFields, PostIndexes>(db, ['fr', 'en'], postSchema);

	// 	// Post.
	// 	debugger;
	// });


});