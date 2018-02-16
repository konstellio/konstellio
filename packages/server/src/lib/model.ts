import { DocumentNode } from "graphql";
import { parseSchema } from "../utils/parseSchema";

export async function buildModels(graph: DocumentNode): Promise<Model[]> {
	const schemas = parseSchema(graph);

	debugger;

	throw new Error(`Not implemented.`);
}

export class Model {

}