"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const chai_1 = require("chai");
const graphql_1 = require("graphql");
const db_1 = require("@konstellio/db");
const migration_1 = require("./utilities/migration");
const collection_1 = require("./collection");
chai_1.should();
describe("Collection", () => {
    let db;
    let locales;
    let ast;
    let schema;
    before(() => __awaiter(this, void 0, void 0, function* () {
        db = yield new db_1.SQLiteDriver({
            filename: ':memory:'
        }).connect();
        yield db.execute('CREATE TABLE User (id TEXT PRIMARY KEY, username TEXT, password TEXT, "group" TEXT)');
        yield db.execute('CREATE TABLE PostCategory (id TEXT PRIMARY KEY, title__fr TEXT, title__en TEXT, slug__fr TEXT, slug__en TEXT)');
        yield db.execute('CREATE TABLE Post (id TEXT PRIMARY KEY, title__fr TEXT, title__en TEXT, slug__fr TEXT, slug__en TEXT, postDate TEXT, expireDate TEXT, content TEXT)');
        yield db.execute('CREATE TABLE Relation (id TEXT PRIMARY KEY, collection TEXT, field TEXT, source TEXT, target TEXT, seq TEXT)');
        yield db.execute(db_1.q.insert('User').add({
            id: 'mgrenier',
            username: 'mgrenier',
            password: '1234',
            group: 'Admin'
        }));
        yield db.execute(db_1.q.insert('PostCategory').add({
            id: 'blog',
            title__fr: 'Blogue',
            title__en: 'Blog',
            slug__fr: 'blogue',
            slug__en: 'blog'
        }));
        yield db.execute(db_1.q.insert('Post').add({
            id: 'post1',
            title__fr: 'Mon premier blogue post',
            title__en: 'My first blog post',
            slug__fr: 'mon-premier-blogue-post',
            slug__en: 'my-first-blog-post',
            postDate: '2018-08-05 20:45:00',
            content: '...'
        }));
        yield db.execute(db_1.q.insert('Relation').add({
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
        ast = graphql_1.parse(`
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
		`);
        schema = yield migration_1.createSchemaFromDefinitions(ast, locales);
    }));
    it('create collections', () => __awaiter(this, void 0, void 0, function* () {
        const [Users, Categories, Posts] = collection_1.createCollections(db, schema, ast, locales);
        const t = yield Posts.findById('post1', { locale: 'fr', fields: [db_1.q.field('title')] });
        // const t = await Posts.find({
        // 	fields: [q.field('title')],
        // 	condition: q.and(q.gt('slug', 'aaaa'), q.eq('author', '1111')),
        // 	sort: [q.sort('title', 'desc')]
        // });
        debugger;
    }));
});
//# sourceMappingURL=collection.spec.js.map