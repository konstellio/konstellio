
module.exports = {
	graphql() {
		return `
			extend type Query {
				latestPost(first: Int, after: Cursor): [PostCursor!]!
			}

			extend type User {
				birthday: Date! @field(label: "Birthday", type: "date")
				displayName: String!
			}

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
		`;
	},
	resolvers() {
		return {
			Query: {
				async latestPost(parent, { first, after }, context, info) {
					return [];
				}
			},
			User: {
				displayName: {
					fragment: `fragment UserFragment on User { username }`,
					async resolve(parent, args, context, info) {
						return parent.username;
					}
				}
			}
		};
	}
};