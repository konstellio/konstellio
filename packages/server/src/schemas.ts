
const schemas = [{
	typeDefs: `
		scalar Cursor
		scalar Date
		scalar DateTime

		type User @model {
			id: ID!
			username: String! @field(label: "Username", type: "text")
			password: String! @field(label: "Password", type: "password") @permission(group: "noone")
		}

		type File @model {
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
	`,
	resolvers: {
		Query: {
			async whoami() {
				return {
					id: 'needs-an-ID',
					username: 'someone'
				}
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
	}
}, {
	typeDefs: `
		extend type User {
			birthday: Date! @field(label: "Birthday", type: "date")
			displayName: String!
		}
	`,
	resolvers: {
		User: {
			displayName: {
				fragment: `fragment UserFragment on User { username }`,
				async resolve(parent, args, context, info) {
					return parent.username;
				}
			}
		}
	}
}, {
	typeDefs: `
		type Post @model {
			id: ID!
			title: String! @field(label: "Title", type: "text")
			slug: String! @field(type: "slug", on: "title")
			postDate: DateTime! @field(label: "Post date", type: "datetime")
			expireDate: DateTime @field(label: "Expire date", type: "datetime")
			author: User! @field(label: "Author", type: "relation")
			content: String! @field(label: "Content", type: "html")
		}

		type PostCursor {
			cursor: Cursor
			item: Post!
		}

		extend type Query {
			latestPost(first: Int, after: Cursor): [PostCursor!]!
		}
	`,
	resolvers: {
		Query: {
			async latestPost(parent, { first, after }, context, info) {
				return [];
			}
		}
	}
}];

export default schemas;