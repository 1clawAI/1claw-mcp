/**
 * Compatibility shim: the client now lives in ./client/ split by domain.
 * Tools import from here so nothing outside the client tree had to move.
 */
export * from "./client/index.js";
