import "mocha";
import { should } from "chai";
import { DocumentNode, parse } from "graphql";
import { Database, q } from "@konstellio/db";
import { DatabaseSQLite } from "@konstellio/db-sqlite";
import { Locales } from "./server";
import { Schema, createSchemaFromDefinitions } from "./utilities/migration";
import { createCollections } from "./collection";
should();

describe("Collection", () => {

	let db: Database;
	let locales: Locales;
	let ast: DocumentNode;
	let schema: Schema;


	before(async () => {
		db = await new DatabaseSQLite({
			filename: ':memory:'
		}).connect();
		await db.execute('CREATE TABLE User (id TEXT PRIMARY KEY, username TEXT, password TEXT, "group" TEXT)');
		await db.execute('CREATE TABLE PostCategory (id TEXT PRIMARY KEY, title__fr TEXT, title__en TEXT, slug__fr TEXT, slug__en TEXT)');
		await db.execute('CREATE TABLE Post (id TEXT PRIMARY KEY, title__fr TEXT, title__en TEXT, slug__fr TEXT, slug__en TEXT, postDate TEXT, expireDate TEXT, content TEXT)');
		await db.execute('CREATE TABLE Relation (id TEXT PRIMARY KEY, collection TEXT, field TEXT, source TEXT, target TEXT, seq TEXT)');
		await db.execute(q.insert('User').add({
			id: 'mgrenier',
			username: 'mgrenier',
			password: '1234',
			group: 'Admin'
		}));
		await db.execute(q.insert('PostCategory').add({
			id: 'blog',
			title__fr: 'Blogue',
			title__en: 'Blog',
			slug__fr: 'blogue',
			slug__en: 'blog'
		}));
		await db.execute(q.insert('Post').add({
			id: 'post1',
			title__fr: 'Mon premier blogue post',
			title__en: 'My first blog post',
			slug__fr: 'mon-premier-blogue-post',
			slug__en: 'my-first-blog-post',
			postDate: '2018-08-05 20:45:00',
			content: '...'
		}));
		await db.execute(q.insert('Relation').add({
			id: 'post1_author',
			collection: 'User',
			field: 'author',
			source: 'post1',
			target: 'mgrenier',
			seq: '1'
		}));

		locales = {
			en: 'English',
			fr: 'French'
		};
		ast = parse(`
			enum Group {
				Guest
			}

			type User
			@collection
			@index(handle: "User_username", type: "unique", fields: [{ field: "username", direction: "asc" }])
			{
				id: ID!
				username: String!
				password: String!
				group: Group
			}

			type PostCategory
			@collection(type: "structure")
			{
				id: ID!
				title: String! @localized
				slug: String! @localized
			}

			type Post
			@collection
			@index(handle: "Post_slug", type: "unique", fields: [{ field: "slug", direction: "asc" }])
			{
				id: ID!
				title: String! @localized
				slug: String! @localized
				categories: [PostCategory!]!
				postDate: DateTime!
				expireDate: DateTime
				author: User!
				contributors: [User!]!
				content: [Content!]! @localized
			}

			union Content = ContentTitle | ContentText

			type ContentTitle {
				title: String!
				subtitle: String
				text: String
			}
			type ContentText {
				text: String!
			}
		`);
		schema = await createSchemaFromDefinitions(ast, locales);
	});

	it('create collections', async () => {
		const [Users, Categories, Posts] = createCollections(db, schema, ast, locales);
		
		// const t = await Posts.findById('post1', { locale: 'fr', fields: [q.field('title'), q.as('title', 'bleh')] });
		const t = await Posts.find({
			fields: [q.field('title'), q.field('slug'), q.field('author')],
			condition: q.and(q.gte('slug', 'my-first-blog-post'), q.eq('author', 'mgrenier')),
			sort: [q.sort('title', 'desc')]
		});

		const u = await Posts.create({
			title: {
				fr: 'Mon deuxième blogue post',
				en: 'My second blog post'
			},
			slug: {
				fr: 'mon-deuxieme-blogue-post',
				en: 'my-second-blog-post'
			},
			categories: [],
			postDate: '2018-08-23 20:45:00',
			author: 'mgrenier',
			contributors: ['mgrenier'],
			content: {
				en: [],
				fr: []
			}
		});

		debugger;
	});

});