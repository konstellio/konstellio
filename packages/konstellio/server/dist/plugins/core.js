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
exports.default = {
    identifier: 'konstellio/core',
    getTypeDef() {
        return __awaiter(this, void 0, void 0, function* () {
            return `
			scalar Cursor
			scalar Date
			scalar DateTime

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

			type File
			@collection
			{
				id: ID!
				path: String!
				name: String!
				size: Int!
				creation: DateTime!
				modification: DateTime!
			}

			type Query {
				me: User!
			}

			type Mutation {
				login(username: String!, password: String!): LoginResponse
				logout: LogoutResponse
				createUser(data: UserInput): Boolean
			}

			type LoginResponse {
				token: String!
			}
			type LogoutResponse {
				acknowledge: Boolean!
			}
		`;
        });
    },
    getResolvers() {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                Query: {
                    me() {
                        return __awaiter(this, void 0, void 0, function* () {
                            // console.log(getSelectionsFromInfo(info));
                            return {
                                id: 'bleh',
                                username: 'mgrenier',
                                group: 'Author',
                                birthday: '1986-03-17'
                            };
                        });
                    }
                },
                Mutation: {
                    login(_, { username, password }, {}) {
                        return __awaiter(this, void 0, void 0, function* () {
                            return {
                                token: `${username}:${password}`
                            };
                        });
                    },
                    logout(_, {}, {}) {
                        return __awaiter(this, void 0, void 0, function* () {
                            return {
                                acknowledge: true
                            };
                        });
                    }
                }
            };
        });
    }
};
//# sourceMappingURL=core.js.map