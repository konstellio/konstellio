import { createServer } from 'http';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import { parse, visit, Kind, FieldDefinitionNode, GraphQLSchema, GraphQLScalarType, GraphQLObjectType, GraphQLInterfaceType, StringValueNode } from 'graphql';
import { buildSchemaFromTypeDefinitions, SchemaError } from 'graphql-tools';
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

	const groups = ['nobody']

	const groupAst = visit(ast, {
		[Kind.FIELD_DEFINITION](node: FieldDefinitionNode) {
			const permission = node.directives && node.directives.find(directive => directive.name.value === 'permission');
			if (permission) {
				const argGroup = permission.arguments && permission.arguments.find(arg => arg.name.value === 'group');
				if (argGroup) {
					const value = (argGroup.value as StringValueNode).value;
					if (groups.indexOf(value) === -1) {
						console.log('Deleting', node.name.value);
						return null; // returning null will delete this node
					}
				}
			}
		}
	});
	
	// TODO modify `ast` with AST transformer (hide @permission, etc)
	const schema = buildSchemaFromTypeDefinitions(groupAst);
	addResolveFunctionsToSchema(schema, resolvers);
	// TODO cache the new `schema` for "group"
	
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

	return {
		schema
	};
}));

const server = createServer(app);
server.listen(8080, () => {
	console.log(`GraphQL server is now running on http://localhost:8080/.`);
});

function getFieldsForType(type: any) {
	if (type instanceof GraphQLObjectType ||
		type instanceof GraphQLInterfaceType) {
		return type.getFields();
	}
	else {
		return undefined;
	}
}
function setFieldProperties(field: any, propertiesObj: any) {
	Object.keys(propertiesObj).forEach((propertyName) => {
		field[propertyName] = propertiesObj[propertyName];
	});
}
function addResolveFunctionsToSchema(schema: GraphQLSchema, resolveFunctions: any) {
	Object.keys(resolveFunctions).forEach((typeName: string) => {
		const type = schema.getType(typeName);
		Object.keys(resolveFunctions[typeName]).forEach((fieldName: string) => {
			if (fieldName.startsWith('__')) {
				// this is for isTypeOf and resolveType and all the other stuff.
				// TODO require resolveType for unions and interfaces.
				type[fieldName.substring(2)] = resolveFunctions[typeName][fieldName];
				return;
			}
			if (type instanceof GraphQLScalarType) {
				type[fieldName] = resolveFunctions[typeName][fieldName];
				return;
			}
			const fields = getFieldsForType(type);
			if (fields) {
				const field = fields[fieldName];
				const fieldResolve = resolveFunctions[typeName][fieldName];
				if (typeof fieldResolve === 'function') {
					setFieldProperties(field, { resolve: fieldResolve });
				}
				else {
					if (typeof fieldResolve !== 'object') {
						throw new SchemaError("Resolver " + typeName + "." + fieldName + " must be object or function");
					}
					setFieldProperties(field, fieldResolve);
				}
			}
		});
	});
}