import 'mocha';
import { expect } from 'chai';
import { Document } from './Document';
import { Schema, Field, Type } from 'konstellio-schema';
import { SQLiteDriver } from './Drivers/SQLiteDriver';

describe('Document', () => {

	let driver: SQLiteDriver;

	before(function (done) {
		this.timeout(10000);

		driver = new SQLiteDriver({
			filename: ':memory:'
		});

		driver.connect()
			.then(() => driver.execute('CREATE TABLE Bar_Foo (title TEXT, postDate TEXT, likes INTEGER)'))
			.then(() => done()).catch(done);
	});

	it('blows', () => {

		interface PostCategoryType {
			id: string
			title: string
		}
		const postCategorySchema = new Schema([
			new Field('id', 'ID', new Type.NonNull(Type.String)),
			new Field('title', 'Title', new Type.InRange(10))
		]);
		interface PostType {
			id: string
			title: string
			exerpt: string
			content: string
		}
		const postSchema = new Schema([
			new Field('id', 'ID', new Type.NonNull(Type.String)),
			new Field('title', 'Title', new Type.InRange(10)),
			new Field('category', 'Category', Type.String),
			new Field('exerpt', 'Exerpt', Type.String),
			new Field('content', 'Content', Type.String)
		]);

		const PostCategory = new Document<PostType>(driver, postCategorySchema);
		const Post = new Document<PostType>(driver, postSchema);

		const cat = PostCategory.create();
		const post = Post.create();

		Promise.resolve()
			.then(() => PostCategory.insert(cat))
			.then(() => Post.insert(post))

	});


});