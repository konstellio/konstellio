
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

			type Post @model(indexes: [{ handle: "Post_slug", type: "unique", fields: { slug: "asc" } }]) {
				id: ID!
				title: String! @field(label: "Title", type: "text", localized: true)
				slug: String! @field(type: "text", field: "slug", on: "title", localized: true)
				postDate: DateTime! @field(label: "Post date", type: "datetime")
				expireDate: DateTime @field(label: "Expire date", type: "datetime")
				author: User! @field(label: "Author", type: "relation", field: "relation", model: "User")
				content: String! @field(label: "Content", type: "html", localized: true)
			}

			type PostCursor {
				cursor: String
				item: Post!
			}
		`;
	},
	resolvers() {
		return {
			Query: {
				async latestPost(parent, { first, after }, { q, records }, info) {
					const Post = records.get('Post');
					const latest = await Post.find({
						locale: 'fr',
						sort: [q.sort('postDate', 'desc')],
						offset: 0,
						limit: first || 10
					});

					return latest.map(post => ({
						cursor: 'bleh',
						item: post
					}));
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