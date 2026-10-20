export * from './types';
export * from './board';
export { compileTopology, isRegionMap } from './topology';
export { checkErrors, isSolved } from './rules';
export {
  GenerationError,
  SearchLimitError,
  type SearchOptions,
} from './search';
export {
  countSolutions,
  generatePuzzle,
  generateGame,
  generateRandomRegionMap,
  type GeneratedGame,
} from './generator';
