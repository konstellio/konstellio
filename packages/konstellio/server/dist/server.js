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
const assert = require("assert");
const fastify = require("fastify");
const apollo_server_core_1 = require("apollo-server-core");
const core_1 = require("./plugins/core");
const graphql_1 = require("graphql");
const ast_1 = require("./utilities/ast");
const migration_1 = require("./utilities/migration");
const collection_1 = require("./collection");
const graphql_tools_1 = require("graphql-tools");
const graphql_playground_html_1 = require("graphql-playground-html");
var ServerListenMode;
(function (ServerListenMode) {
    ServerListenMode[ServerListenMode["All"] = 3] = "All";
    ServerListenMode[ServerListenMode["Graphql"] = 1] = "Graphql";
    ServerListenMode[ServerListenMode["Websocket"] = 2] = "Websocket";
    ServerListenMode[ServerListenMode["Worker"] = 6] = "Worker";
})(ServerListenMode = exports.ServerListenMode || (exports.ServerListenMode = {}));
function createServer(config) {
    return __awaiter(this, void 0, void 0, function* () {
        const [db, fs, cache, mq] = yield Promise.all([
            createDatabase(config.database),
            createFilesystem(config.fs || { driver: 'local', root: __dirname }),
            createCache(config.cache || { driver: 'memory' }),
            createMessageQueue(config.mq || { driver: 'memory' })
        ]);
        return new Server(config, db, fs, cache, mq);
    });
}
exports.createServer = createServer;
class Server {
    constructor(config, database, fs, cache, mq) {
        this.config = config;
        this.database = database;
        this.fs = fs;
        this.cache = cache;
        this.mq = mq;
        this.disposed = false;
        this.plugins = [];
    }
    disposeAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.disposed === true) {
                return;
            }
            // FIXME: Expose missing disposeAsync;
            // await this.database.disposeAsync();
            yield this.fs.disposeAsync();
            yield this.cache.disposeAsync();
            // await this.mq.disposeAsync();
        });
    }
    isDisposed() {
        return this.disposed;
    }
    register(plugin) {
        assert(plugin.identifier, 'Plugin needs an identifier');
        this.plugins.push(plugin);
    }
    listen({ skipMigration, mode } = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isDisposed()) {
                throw new Error(`Can not call Server.listen on a disposed server.`);
            }
            skipMigration = !!skipMigration;
            mode = mode || ServerListenMode.All;
            const status = { mode };
            // Reorder plugin to respect their dependencies
            const pluginOrder = [core_1.default].concat(reorderPluginOnDependencies(this.plugins));
            // Gather plugins type definition
            const typeDefs = yield Promise.all(pluginOrder.map((plugin) => __awaiter(this, void 0, void 0, function* () {
                return plugin.getTypeDef ? plugin.getTypeDef(this) : '';
            })));
            // Parse type definition to AST
            const ASTs = typeDefs.map(typeDef => graphql_1.parse(typeDef));
            // Let plugin extend AST by providing an other layer of type definition
            const typeDefExtensions = [
                collection_1.createTypeExtensionsFromDatabaseDriver(this.database, this.config.locales)
            ];
            for (const ast of ASTs) {
                const extended = yield Promise.all(pluginOrder.reduce((typeDefs, plugin) => {
                    if (plugin.getTypeExtension) {
                        typeDefs.push(Promise.resolve(plugin.getTypeExtension(this, ast)));
                    }
                    return typeDefs;
                }, [
                    Promise.resolve(collection_1.createTypeExtensionsFromDefinitions(ast, this.config.locales))
                ]));
                const typeDefExtension = extended.join(`\n`).trim();
                if (typeDefExtension) {
                    typeDefExtensions.push(typeDefExtension);
                }
            }
            ASTs.push(...typeDefExtensions.map(typeDef => graphql_1.parse(typeDef)));
            // Merge every AST
            const mergedAST = ast_1.mergeAST(ASTs);
            const astSchema = yield migration_1.createSchemaFromDefinitions(mergedAST, this.config.locales);
            // Do migration
            if (skipMigration === false) {
                const dbSchema = yield migration_1.createSchemaFromDatabase(this.database, this.config.locales);
                const schemaDiffs = yield migration_1.promptSchemaDiffs(process.stdin, process.stdout, migration_1.computeSchemaDiff(dbSchema, astSchema, this.database.compareTypes), this.database.compareTypes);
                if (schemaDiffs.length > 0) {
                    yield migration_1.executeSchemaDiff(schemaDiffs, this.database);
                }
            }
            // TODO: Create collections with mergedAST
            const collections = collection_1.createCollections(this.database, astSchema, mergedAST, this.config.locales);
            debugger;
            // Create input type from definitions
            const inputTypeDefinitions = collection_1.createInputTypeFromDefinitions(mergedAST, this.config.locales);
            // Gather plugins resolvers
            const resolvers = yield Promise.all(pluginOrder.map((plugin) => __awaiter(this, void 0, void 0, function* () {
                return plugin.getResolvers ? plugin.getResolvers(this) : {};
            })));
            // Merge every resolvers
            const mergedResolvers = resolvers.reduce((resolvers, resolver) => {
                Object.keys(resolver).forEach(key => {
                    resolvers[key] = Object.assign(resolvers[key] || {}, resolver[key]);
                });
                return resolvers;
            }, {});
            // Create fragment from resolvers
            const fragments = Object.keys(mergedResolvers).reduce((fragments, typeName) => {
                const type = mergedResolvers[typeName];
                return Object.keys(type).reduce((fragments, fieldName) => {
                    const field = type[fieldName];
                    if (typeof field === 'object' && typeof field.resolve === 'function' && typeof field.fragment === 'string') {
                        fragments.push({ field: fieldName, fragment: field.fragment });
                    }
                    return fragments;
                }, fragments);
            }, []);
            // Create schema
            const baseSchema = graphql_tools_1.makeExecutableSchema({
                typeDefs: [mergedAST, inputTypeDefinitions],
                resolvers: mergedResolvers
            });
            // Emulate mergeSchemas resolver's fragment
            const extendedSchema = graphql_tools_1.transformSchema(baseSchema, [
                new graphql_tools_1.ReplaceFieldWithFragment(baseSchema, fragments)
            ]);
            if (mode & ServerListenMode.Graphql) {
                const app = fastify();
                app.get('/', (_, res) => __awaiter(this, void 0, void 0, function* () {
                    res.send({
                        mode,
                        plugins: this.plugins
                    });
                }));
                // TODO: Auth => https://github.com/fastify/fastify-cookie/blob/master/plugin.js
                // TODO: Create a websocker server => https://github.com/fastify/fastify-websocket/blob/master/index.js
                app.get('/playground', (_, res) => __awaiter(this, void 0, void 0, function* () {
                    const html = graphql_playground_html_1.renderPlaygroundPage({
                        endpoint: '/graphql',
                        version: '1.6.6'
                    });
                    res.header('Content-Type', 'text/html');
                    res.send(html);
                }));
                app.route({
                    method: ['GET', 'POST'],
                    url: '/graphql',
                    handler(req, res) {
                        return __awaiter(this, void 0, void 0, function* () {
                            // TODO: Build schema for this request & cache it
                            try {
                                const result = yield apollo_server_core_1.runHttpQuery([req, res], {
                                    method: 'POST',
                                    options: {
                                        schema: extendedSchema
                                    },
                                    query: req.body || req.query
                                });
                                // res.header('Content-Length', Buffer.byteLength(result, 'utf8').toString()); // FIXME: Required ?
                                res.send(JSON.parse(result));
                            }
                            catch (error) {
                                if (error.name === 'HttpQueryError') {
                                    for (let key in error.headers) {
                                        res.header(key, error.headers[key]);
                                    }
                                    // res.code(error.statusCode); // FIXME: Required ?
                                    res.send(JSON.parse(error.message));
                                }
                            }
                        });
                    }
                });
                yield new Promise((resolve, reject) => {
                    app.listen(this.config.http && this.config.http.port || 8080, this.config.http && this.config.http.host || '127.0.0.1', (err) => {
                        if (err)
                            return reject(err);
                        const addr = app.server.address();
                        status.family = addr.family;
                        status.address = addr.address;
                        status.port = addr.port;
                        resolve();
                    });
                });
                this.server = app;
            }
            return status;
        });
    }
}
exports.Server = Server;
function reorderPluginOnDependencies(plugins) {
    return plugins.sort((a, b) => {
        const aONb = (a.dependencies || []).indexOf(b.identifier) > -1;
        const bONa = (b.dependencies || []).indexOf(a.identifier) > -1;
        if (aONb) {
            if (bONa) {
                throw new Error(`Detected circular plugin dependency between ${a.identifier} and ${b.identifier}`);
            }
            return 1;
        }
        return bONa ? -1 : 0;
    });
}
function createDatabase(config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (config.driver === 'sqlite') {
            const { SQLiteDriver } = require('@konstellio/db');
            return new SQLiteDriver(config.filename === 'mock://memory'
                ? Object.assign({}, config, { filename: ':memory:' })
                : config).connect();
        }
        throw new ReferenceError(`Unsupported database driver ${config.driver}.`);
    });
}
function createFilesystem(config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (config.driver === 'local') {
            const { LocalFileSystem } = require('@konstellio/fs');
            return new LocalFileSystem(config.root);
        }
        throw new ReferenceError(`Unsupported file system driver ${config.driver}.`);
    });
}
function createCache(config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (config.driver === 'memory') {
            const { RedisMockDriver } = require('@konstellio/cache');
            return new RedisMockDriver().connect();
        }
        else if (config.driver === 'redis') {
            const { RedisDriver } = require('@konstellio/cache');
            return new RedisDriver(config.uri).connect();
        }
        throw new ReferenceError(`Unsupported cache driver ${config.driver}.`);
    });
}
function createMessageQueue(config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (config.driver === 'memory') {
            const { MemoryDriver } = require('@konstellio/mq');
            return new MemoryDriver().connect();
        }
        else if (config.driver === 'amqp') {
            const { AMQPDriver } = require('@konstellio/mq');
            return new AMQPDriver(config.uri).connect();
        }
        throw new ReferenceError(`Unsupported message queue driver ${config.driver}.`);
    });
}
//# sourceMappingURL=server.js.map