// Every tool implements:
//   name: string (unique, matches what the model calls)
//   description: string (shown to the model so it knows when to use it)
//   inputSchema: JSON schema for arguments
//   async execute(args, context) -> any JSON-serializable result
//   Errors should throw with a clear, user-safe message.

import { webSearchTool } from "./webSearchTool.js";
import { calculatorTool } from "./calculatorTool.js";
import { fileReaderTool } from "./fileReaderTool.js";
import { urlReaderTool } from "./urlReaderTool.js";

const tools = [webSearchTool, calculatorTool, fileReaderTool, urlReaderTool];

export function getAllTools() {
  return tools;
}

export function getToolByName(name) {
  return tools.find((t) => t.name === name);
}

export function toolDescriptorsForModel() {
  return tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}
