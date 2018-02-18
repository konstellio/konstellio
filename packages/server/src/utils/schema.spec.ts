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

	it('test', () => {

		const typeDefs: string = `
			scalar Cursor
			scalar Date
			scalar DateTime

			type User @model(label: "Utilisateurs", indexes: [{ type: "unique", fields: { username: "asc" } }]) {
				id: ID!
				username: String! @field(label: "Username", type: "text")
				password: String! @field(label: "Password", type: "text", field: "password") @permission(group: "noone")
			}

			type File @model(indexes: [{ fields: { path: "asc", name: "asc" } }, { fields: { creation: "asc" } }]) {
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

			extend type User @model(indexes: [{ fields: { birthday: "asc" } }]) {
				birthday: Date! @field(label: "Birthday", type: "date")
				displayName: String!
			}

			type Post @model(indexes: [{ fields: { postDate: "asc" } }, { type: "unique", fields: { slug: "asc" } }]) {
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
	
			extend type Query {
				latestPost(first: Int, after: Cursor): [PostCursor!]!
			}
		`;

		const resolvers: IResolvers = {
			User: {
				displayName: {
					fragment: `fragment UserFragment on User { username }`,
					async resolve(parent, args, context, info) {
						return parent.username;
					}
				}
			},
			Query: {
				async whoami() {
					return {
						id: 'needs-an-ID',
						username: 'someone'
					}
				},
				async latestPost(parent, { first, after }, context, info) {
					return [];
				}
			},
			Mutation: {
				async login(parent, { username, password }, context, info) {
					return {
						token: "what-token?"
					};
				},
				async logout() {
					return {
						acknowledge: true
					};
				}
			}
		};

        const ast = parse(typeDefs);

		// Clone & modify `ast` based on some logic (hide @permission field)
		const context = { groups: ['nobody'] };
		const astModified = visit(ast, {
			[Kind.FIELD_DEFINITION](node: FieldDefinitionNode) {
				const permission = node.directives && node.directives.find(directive => directive.name.value === 'permission');
				if (permission) {
					const argGroup = permission.arguments && permission.arguments.find(arg => arg.name.value === 'group');
					if (argGroup) {
						const value = (argGroup.value as StringValueNode).value;
						if (context.groups.indexOf(value) === -1) {
							return null; // returning null will delete this node
						}
					}
				}
			}
		});

		// Build GraphQLSchema on that new ast and make it executable with resolvers
		const schema = makeExecutableSchema({
			typeDefs: ast,
			resolvers,
			resolverValidationOptions: {
				allowResolversNotInSchema: true
			}
		});

        const models = parseSchema(ast);

		return Promise.all([
            graphql(schema, `{ whoami { id displayName } }`).should.eventually.deep.equal({
                data: {
                    whoami: {
                        id: "needs-an-ID",
                        displayName: "someone"
                    }
                }
            }),
            expect(models).to.deep.equal([{
                handle: 'User',
                label: 'Utilisateurs',
                description: '',
                fields: [{
                    handle: 'username',
                    group: 'default',
                    label: 'Username',
                    type: 'text',
                    field: 'text',
                    description: ''
                }, {
                    handle: 'password',
                    group: 'default',
                    label: 'Password',
                    type: 'text',
                    field: 'password',
                    description: ''
                }, {
                    handle: 'birthday',
                    group: 'default',
                    label: 'Birthday',
                    type: 'date',
                    field: 'text',
                    description: ''
                }],
                indexes: [{
                    type: 'unique',
                    fields: { username: 'asc' }
                }, {
                    type: 'index',
                    fields: { birthday: 'asc' }
                }]
            }, {
                handle: 'File',
                label: 'File',
                description: '',
                fields: [{
                    handle: 'path',
                    group: 'default',
                    label: 'path',
                    type: 'text',
                    field: 'text',
                    description: ''
                }, {
                    handle: 'name',
                    group: 'default',
                    label: 'name',
                    type: 'text',
                    field: 'text',
                    description: ''
                }, {
                    handle: 'size',
                    group: 'default',
                    label: 'size',
                    type: 'int',
                    field: 'text',
                    description: ''
                }, {
                    handle: 'creation',
                    group: 'default',
                    label: 'creation',
                    type: 'datetime',
                    field: 'text',
                    description: ''
                }, {
                    handle: 'modification',
                    group: 'default',
                    label: 'modification',
                    type: 'datetime',
                    field: 'text',
                    description: ''
                }],
                indexes: [{
                    type: 'index',
                    fields: { path: 'asc', name: 'asc' }
                }, {
                    type: 'index',
                    fields: { creation: 'asc' }
                }]
            }, {
                handle: 'Post',
                label: 'Post',
                description: '',
                fields: [{
                    handle: 'title',
                    group: 'default',
                    label: 'Title',
                    type: 'text',
                    field: 'text',
                    description: ''
                }, {
                    handle: 'slug',
                    group: 'default',
                    label: 'slug',
                    type: 'slug',
                    field: 'text',
                    description: '',
                    on: 'title'
                }, {
                    handle: 'postDate',
                    group: 'default',
                    label: 'Post date',
                    type: 'datetime',
                    field: 'text',
                    description: ''
                }, {
                    handle: 'expireDate',
                    group: 'default',
                    label: 'Expire date',
                    type: 'datetime',
                    field: 'text',
                    description: ''
                }, {
                    handle: 'author',
                    group: 'default',
                    label: 'Author',
                    type: 'relation',
                    field: 'text',
                    description: ''
                }, {
                    handle: 'content',
                    group: 'default',
                    label: 'Content',
                    type: 'text',
                    field: 'html',
                    description: ''
                }],
                indexes: [{
                    type: 'index',
                    fields: { postDate: 'asc' }
                }, {
                    type: 'unique',
                    fields: { slug: 'asc' }
                }]
            }])
		])
	});

})