import 'mocha';
import { use, expect, should } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { IResolvers } from 'graphql-tools/dist/Interfaces';
import { parseSchema, Field } from './schema';
import { Kind, FieldDefinitionNode, StringValueNode } from 'graphql';
import { parse } from 'graphql/language/parser';
import { visit } from 'graphql/language/visitor';
import { graphql } from 'graphql/graphql';
import { makeExecutableSchema } from 'graphql-tools/dist/schemaGenerator';


before(() => {
	should();
	use(chaiAsPromised);
})

describe('Schema', () => {

	it('test', async () => {

		const typeDefs: string = `
			scalar Cursor
			scalar Date
			scalar DateTime

			type User @record(label: "Utilisateurs", indexes: [{ handle: "User_username", type: "unique", fields: { username: "asc" } }]) {
				id: ID!
				username: String! @field(label: "Username", type: "text")
				password: String! @field(label: "Password", type: "text", field: "password") @permission(group: "noone")
			}

			type File @record(indexes: [{ handle: "File_name", fields: { path: "asc", name: "asc" } }, { handle: "File_creation", fields: { creation: "asc" } }]) {
				id: ID!
				path: String! @field(type: "text")
				name: String! @field(type: "text")
				size: Int! @field(type: "int")
				creation: DateTime! @field(type: "datetime")
				modification: DateTime! @field(type: "datetime")
			}

			type Query {
				whoami: User!
			}

			type LoginResponse {
				token: String!
			}

			type LogoutResponse {
				acknowledge: Boolean!
			}

			type Mutation {
				login(username: String!, password: String!): LoginResponse @permission(group: "nobody")
				logout: LogoutResponse @permission(group: "any")
			}

			extend type User @record(indexes: [{ handle: "User_birthday", fields: { birthday: "asc" } }]) {
				birthday: Date! @field(label: "Birthday", type: "date")
				displayName: String!
			}

			type Post @record(indexes: [{ handle: "Post_postDate", fields: { postDate: "asc" } }, { handle: "Post_slug", type: "unique", fields: { slug: "asc" } }]) {
				id: ID!
				title: String! @field(label: "Title", type: "text")
				slug: String! @field(type: "slug", on: "title")
				postDate: DateTime! @field(label: "Post date", type: "datetime")
				expireDate: DateTime @field(label: "Expire date", type: "datetime")
				author: [User!]! @field(label: "Author", type: "relation")
				content: String! @field(label: "Content", type: "text", field: "html")
			}
	
			type PostCursor {
				cursor: Cursor
				item: Post!
			}

			union Page @record = PageHome | PageContact

			type PageHome @record {
				id: ID!
				heading: String! @field(label: "Heading", type: "text", localized: true)
				welcome: String! @field(label: "Welcome", type: "text", localized: true)
			}

			type PageContact @record {
				id: ID!
				about: String! @field(label: "About", type: "text", localized: true)
				phone: String! @field(label: "Phone", type: "text")
				email: String! @field(label: "Email", type: "text")
			}
	
			extend type Query {
				latestPost(first: Int, after: Cursor): [PostCursor!]!
				pages: [Page!]!
			}
		`;

		const ast = parse(typeDefs);
		const schemas = parseSchema(ast);

		expect(schemas[0]).to.deep.equal({
			handle: 'User',
			label: 'User',
			description: '',
			indexes: [{
				type: 'unique',
				handle: 'User_username',
				fields: { username: 'asc' }
			}, {
				type: 'index',
				handle: 'User_birthday',
				fields: { birthday: 'asc' }
			}, {
				type: 'primary',
				handle: 'User_id',
				fields: { id: 'asc' }
			}],
			shapes: [{
				handle: 'User',
				label: 'User',
				description: '',
				fields: [{
					handle: 'username',
					group: 'default',
					label: 'Username',
					type: 'text',
					field: 'text',
					required: true
				}, {
					handle: 'password',
					group: 'default',
					label: 'Password',
					type: 'text',
					field: 'password',
					required: true
				}, {
					handle: 'id',
					type: 'text',
					field: 'text',
					required: true
				}, {
					handle: 'birthday',
					group: 'default',
					label: 'Birthday',
					type: 'date',
					field: 'text',
					required: true
				}]
			}],
		});

		expect(schemas[1]).to.deep.equal({
			handle: 'File',
			label: 'File',
			description: '',
			indexes: [{
				type: 'index',
				handle: 'File_name',
				fields: { name: 'asc', path: 'asc' }
			}, {
				type: 'index',
				handle: 'File_creation',
				fields: { creation: 'asc' }
			}, {
				type: 'primary',
				handle: 'File_id',
				fields: { id: 'asc' }
			}],
			shapes: [{
				handle: 'File',
				label: 'File',
				description: '',
				fields: [{
					handle: 'path',
					group: 'default',
					label: 'path',
					type: 'text',
					field: 'text',
					required: true
				}, {
					handle: 'name',
					group: 'default',
					label: 'name',
					type: 'text',
					field: 'text',
					required: true
				}, {
					handle: 'size',
					group: 'default',
					label: 'size',
					type: 'int',
					field: 'text',
					required: true
				}, {
					handle: 'creation',
					group: 'default',
					label: 'creation',
					type: 'datetime',
					field: 'text',
					required: true
				}, {
					handle: 'modification',
					group: 'default',
					label: 'modification',
					type: 'datetime',
					field: 'text',
					required: true
				}, {
					handle: 'id',
					type: 'text',
					field: 'text',
					required: true
				}]
			}],
		});

		expect(schemas[2]).to.deep.equal({
			handle: 'Post',
			label: 'Post',
			description: '',
			indexes: [{
				type: 'index',
				handle: 'Post_postDate',
				fields: { postDate: 'asc' }
			}, {
				type: 'unique',
				handle: 'Post_slug',
				fields: { slug: 'asc' }
			}, {
				type: 'primary',
				handle: 'Post_id',
				fields: { id: 'asc' }
			}],
			shapes: [{
				handle: 'Post',
				label: 'Post',
				description: '',
				fields: [{
					handle: 'title',
					group: 'default',
					label: 'Title',
					type: 'text',
					field: 'text',
					required: true
				}, {
					handle: 'slug',
					group: 'default',
					label: 'slug',
					type: 'slug',
					field: 'text',
					required: true,
					on: 'title'
				}, {
					handle: 'postDate',
					group: 'default',
					label: 'Post date',
					type: 'datetime',
					field: 'text',
					required: true
				}, {
					handle: 'expireDate',
					group: 'default',
					label: 'Expire date',
					type: 'datetime',
					field: 'text',
					required: false
				}, {
					handle: 'author',
					group: 'default',
					label: 'Author',
					type: 'relation',
					field: 'text',
					required: true,
					schema: 'User',
					multiple: true
				}, {
					handle: 'content',
					group: 'default',
					label: 'Content',
					type: 'text',
					field: 'html',
					required: true,
				}, {
					handle: 'id',
					type: 'text',
					field: 'text',
					required: true
				}]
			}],
		});

		expect(schemas[3]).to.deep.equal({
			handle: 'Page',
			label: 'Page',
			description: '',
			indexes: [{
				type: 'primary',
				handle: 'Page_id',
				fields: { id: 'asc' }
			}],
			shapes: [{
				handle: 'PageHome',
				label: 'PageHome',
				description: '',
				fields: [{
					handle: 'heading',
					group: 'default',
					label: 'Heading',
					type: 'text',
					field: 'text',
					required: true,
					localized: true
				}, {
					handle: 'welcome',
					group: 'default',
					label: 'Welcome',
					type: 'text',
					field: 'text',
					required: true,
					localized: true
				}, {
					handle: 'id',
					type: 'text',
					field: 'text',
					required: true
				}, {
					handle: '__type',
					type: 'text',
					field: 'text',
					required: true
				}]
			}, {
				handle: 'PageContact',
				label: 'PageContact',
				description: '',
				fields: [{
					handle: 'about',
					group: 'default',
					label: 'About',
					type: 'text',
					field: 'text',
					required: true,
					localized: true
				}, {
					handle: 'phone',
					group: 'default',
					label: 'Phone',
					type: 'text',
					field: 'text',
					required: true
				}, {
					handle: 'email',
					group: 'default',
					label: 'Email',
					type: 'text',
					field: 'text',
					required: true
				}, {
					handle: 'id',
					type: 'text',
					field: 'text',
					required: true
				}, {
					handle: '__type',
					type: 'text',
					field: 'text',
					required: true
				}]
			}]
		})
	});

})