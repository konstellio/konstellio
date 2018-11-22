import { Service } from './parseConfiguration';
import * as rimraf from 'rimraf';
import { promisify, isArray } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import { parse, print } from 'graphql';
import { mergeDocuments } from './mergeDocuments';
import { baseSchema } from './baseSchema';
import { generatorTypescript } from './generatorTypescript';

const rmtree = promisify(rimraf);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const fileExists = promisify(fs.exists);
const mkdir = promisify(mkdirp);

export async function generate(service: Service): Promise<void> {
	const destination = service.generate
		? path.resolve(service.generate.destination)
		: undefined;
	
	if (!destination) {
		throw new Error(`Can not generate code without destination.`);
	}

	await rmtree(destination);
	await mkdir(destination);

	const schemaFiles = await gatherSchemaFiles(service);
	const schemaBuffers = await Promise.all(schemaFiles.map(file => readFile(file)));
	const documents = [parse(baseSchema)].concat(schemaBuffers.map(schema => parse(schema.toString('utf8'))));
	const document = mergeDocuments(documents);

	const types = generatorTypescript(document, service.locales ? Object.keys(service.locales) : []);
	// const collections = createCollections(document);
	// console.log(print(document));
	debugger;
}

async function gatherSchemaFiles(service: Service): Promise<string[]> {
	const locations: string[] = [];

	for (const schema of service.schema) {
		const location = path.resolve(service.root, schema);
		if (fileExists(location)) {
			locations.push(location);
		}
	}

	for (const pkg of service.import) {
		locations.push(...await gatherSchemaFiles(pkg));
	}

	return locations;
}