
module.exports = async function () {
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