import { loadConfiguration, loadContext, loadExtensions, loadTypeDefs, loadCollectionSchemas, Configuration } from '@konstellio/server';
import { Schema, isUnion, Object, ObjectBase, FieldType, Union } from '@konstellio/odm';
import { dirname, join, relative } from 'path';
import { print as printTypeDefs } from 'graphql';
import { promisify } from 'util';
import { writeFile } from 'fs';
import { header } from './header';
import * as mkdirp from 'mkdirp';
import * as rimraf from 'rimraf';
import { UnionBase, isUnionBase, isObjectBase, isObject, Field } from '../../../odm/dist/schema';

const writeFileAsync = promisify(writeFile);
const mkDirAsync = promisify(mkdirp);
const rmTreeAsync = promisify(rimraf);

export default async function (configurationLocation: string) {
	const configuration = await loadConfiguration(configurationLocation);
	const basedir = dirname(configurationLocation);
	const destination = join(basedir, configuration.generate.destination);

	await rmTreeAsync(destination);
	await mkDirAsync(destination);

	const context = await loadContext(configuration, basedir);
	const extensions = await loadExtensions(configuration, basedir, context);
	const typeDefs = loadTypeDefs(extensions);

	await writeFileAsync(
		join(destination, 'schema.graphql'),
		header.replace(/\/\/ /g, '# ') + printTypeDefs(typeDefs)
	);

	const collectionSchemas = loadCollectionSchemas(typeDefs);
	
	await writeFileAsync(
		join(destination, 'types.d.ts'),
		[
			header,
			`import { ID, Cursor, DateTime, Context as BaseContext, Extension as BaseExtension } from '@konstellio/server';\n`,
			`import { Collection } from '@konstellio/odm';\n`,
			`import Database from '${configuration.database.driver}';\n`,
			`import FileSystem from '${configuration.filesystem.driver}';\n`,
			`import Cache from '${configuration.cache.driver}';\n`,
			`import MessageQueue from '${configuration.mq.driver}';\n`,
			`\n`,
			printCollectionSchemas(collectionSchemas, configuration.locales),
			printContext(collectionSchemas)
		].join('')
	);

	await writeFileAsync(
		join(destination, 'createServer.ts'),
		[
			header,
			`import { join } from 'path';\n`,
			`import { createServer } from '@konstellio/server';\n`,
			`import { Context } from './types.d';\n\n`,
			`export default function () {\n`,
			`\treturn createServer<Context>(join(__dirname, '${relative(join(destination, 'createServer.ts'), configurationLocation).replace(/\\/g, '/')}'));\n`,
			`}\n`
		].join('')
	);
}

export function printCollectionSchemas(schemas: Schema[], locales: Configuration['locales']): string {
	let out = ``;
	const toOutput: (ObjectBase | Object | UnionBase | Union)[] = [...schemas];
	const outputed: string[] = [];

	let schema: ObjectBase | Object | UnionBase | Union | undefined;
	while (schema = toOutput.shift()) {
		if (outputed.includes(schema.handle)) {
			continue;
		}
		outputed.push(schema.handle);

		if (isUnionBase(schema)) {
			out += printUnionBase(schema);
			toOutput.unshift(...schema.objects);
		}
		else if (isObjectBase(schema)) {
			out += printObjectBase(schema);
		}

		if (isUnion(schema) || isObject(schema)) {
			out += printIndexes(schema);
			out += printInputs(schema);
		}
	}

	return out;

	function printUnionBase(obj: UnionBase): string {
		return `export type ${obj.handle} = ${obj.objects.map(o => o.handle).join(' | ')}\n\n`;
	}

	function printObjectBase(obj: ObjectBase): string {
		let out = '';

		out += `export interface ${obj.handle} {\n`;
		for (const field of obj.fields) {
			let type = '';
			switch (field.type) {
				case 'string':
					type = 'String';
					break;
				case 'int':
					type = 'Int';
					break;
				case 'float':
					type = 'Float';
					break;
				case 'boolean':
					type = 'Boolean';
					break;
				case 'date':
					type = 'Date';
					break;
				case 'datetime':
					type = 'DateTime';
					break;
				default:
					type = field.type.handle;
					if (!field.relation) {
						toOutput.unshift(field.type);
					}
					break;
			}
			if (field.handle === 'id' && type === 'String') {
				type = 'ID';
			}
			else if (field.relation) {
				type = 'ID';
			}
			out += `\t${field.handle}${field.required?'':'?'}: ${type}${field.multiple?'[]':''};\n`;
		}
		out += `}\n\n`;

		return out;
	}

	function printIndexes(obj: Union | Object): string {
		let out = `export interface ${obj.handle}Indexes {\n`;
		out += `\tid: ID;\n`;

		const indexedFields = obj.indexes.reduce((fields, index) => {
			for (const field of index.fields) {
				if (!fields.includes(field.handle)) {
					fields.push(field.handle);
				}
			}
			return fields;
		}, [] as string[]);

		const fields = isUnion(obj)
			? obj.objects.reduce((fields, obj) => {
				for (const field of obj.fields) {
					if (indexedFields.includes(field.handle)) {
						if (!fields.find(f => f.handle === field.handle)) {
							fields.push(field);
						}
					}
				}
				return fields;
			}, [] as Field[])
			: obj.fields.filter(f => indexedFields.includes(f.handle));

		for (const field of fields) {
			let type = '';
			switch (field.type) {
				case 'string':
					type = 'String';
					break;
				case 'int':
					type = 'Int';
					break;
				case 'float':
					type = 'Float';
					break;
				case 'boolean':
					type = 'Boolean';
					break;
				case 'date':
					type = 'Date';
					break;
				case 'datetime':
					type = 'DateTime';
					break;
				default:
					type = field.type.handle;
					break;
			}
			out += `\t${field.handle}${field.required?'':'?'}: ${type}${field.multiple?'[]':''};\n`;
		}

		out += `}\n\n`;
		return out;
	}

	function printInputs(obj: Union | Object): string {
		let out = `export interface ${obj.handle}Inputs {\n`;
		out += `\tid?: ID;\n`;
		
		const fields = isUnion(obj)
			? obj.objects.reduce((fields, obj) => {
				for (const field of obj.fields) {
					if (!fields.find(f => f.handle === field.handle)) {
						fields.push(field);
					}
				}
				return fields;
			}, [] as Field[])
			: obj.fields;

			for (const field of fields) {
				let type = '';
				switch (field.type) {
					case 'string':
						type = 'String';
						break;
					case 'int':
						type = 'Int';
						break;
					case 'float':
						type = 'Float';
						break;
					case 'boolean':
						type = 'Boolean';
						break;
					case 'date':
						type = 'Date';
						break;
					case 'datetime':
						type = 'DateTime';
						break;
					default:
						type = field.type.handle;
						break;
				}
				if (field.handle === 'id' && type === 'String') {
					continue;
				}
				else if (field.relation) {
					type = 'ID';
				}

				if (field.localized) {
					type = Object.keys(locales || {}).map(locale => `\t\t${locale}: ${type}${field.multiple?'[]':''};`).join(`\n`);
					out += `\t${field.handle}${field.required?'':'?'}: {\n${type}\n\t};\n`;
				} else {
					out += `\t${field.handle}${field.required?'':'?'}: ${type}${field.multiple?'[]':''};\n`;
				}
			}

		out += `}\n\n`;
		return out;
	}
}

export function printContext(schemas: Schema[]): string {
	let out = ``;

	out += `export interface Context extends BaseContext {\n`;
	out += `\tdatabase: Database;\n`;
	out += `\tfilesystem: FileSystem;\n`;
	out += `\tcache: Cache;\n`;
	out += `\tmq: MessageQueue;\n`;
	out += `\tcollection: {\n`;
	for (const schema of schemas) {
		out += `\t\t${schema.handle}: Collection<${schema.handle}, ${schema.handle}Indexes, ${schema.handle}Inputs>\n`;
	}
	out += `\t};\n`;
	out += `}\n\n`;
	out += `export interface Extension extends BaseExtension<Context> {}\n\n`;

	return out;
}