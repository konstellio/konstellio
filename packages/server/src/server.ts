import { createServer } from 'http';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import { parse } from 'graphql';
import { buildSchemaFromTypeDefinitions, addResolveFunctionsToSchema } from 'graphql-tools';
import { q, SQLiteDriver } from 'konstellio-db';

import schemas from './schemas';
// TODO should get schema from DB (both definition & resolvers code)

// Merge definition & resolvers
const typeDefs = schemas.reduce((acc, schema) => {
    return acc + `\n` + schema.typeDefs;
}, '');
const resolvers = schemas.reduce((acc, schema) => {
    const resolvers = schema.resolvers || {};
    Object.keys(resolvers).forEach(key => {
        acc[key] = acc[key] || {};
        Object.assign(acc[key], resolvers[key]);
    });
    return acc;
}, {});

const ast = parse(typeDefs);
// TODO parse `ast` for DB model directive @model, @field

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));
app.use('/graphql', graphqlExpress((req) => {
    // TODO clone/copy `ast` per "group"
    // TODO modify `ast` with AST transformer (hide @permission, etc)
    // TODO cache the new `ast` for "group"
    
    // Example : remove type/field with @hidden directive
    // function visible (node): boolean {
    //     return node.directives != null && !node.directives.some(directive => directive.name.value === 'hidden');
    // }
    // ast.definitions = ast.definitions.filter(visible);
    // ast.definitions.forEach((definition: any) => {
    //     if (definition.fields) {
    //         definition.fields = definition.fields.filter(visible);
    //     }
    // })

    const schema = buildSchemaFromTypeDefinitions(ast);
    addResolveFunctionsToSchema(schema, resolvers);

    return {
        schema
    };
}));

const server = createServer(app);
server.listen(8080, () => {
    console.log(`GraphQL server is now running on http://localhost:8080/.`);
});


// const db = new SQLiteDriver({
//     filename: 'F:\\Apps\\konstellio\\sculptor-project\\sculptor.sqlite'
// });

// db.connect();

// interface page {
//     id: number
//     parent?: number
//     seq: number
//     lft: number
//     rgt: number
// }

// app.get('/', async (req, res) => {
//     res.set('Content-Type', 'text/plain');
//     try {
//         let entry = await db.execute<page>(q.select().from('entry_page').eq('id', 2));
//         let page = entry.results[0];
//         let children = await db.execute<page>(q.select().from('entry_page').where(q.and(q.gte('lft', page.lft), q.lte('rgt', page.rgt))));
//         res.send(`${JSON.stringify(children.results)}`);
//     } catch (err) {
//         res.send(`${err.stack}`);
//     }
// });

// app.listen(8080, () => {
//     console.log(`Server listening to ...`);
// });