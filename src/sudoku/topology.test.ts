import { describe, expect, it } from 'vitest';
import { CLASSIC_REGION_MAP } from './board';
import { compileTopology } from './topology';
import { generateGame } from './generator';
import { seededRandom } from '../test/fixtures';
describe('compiled constraints', () => {
  it('shares immutable topology by contents, with symmetric unique peers', () => {
    const topology = compileTopology(CLASSIC_REGION_MAP);
    expect(compileTopology(CLASSIC_REGION_MAP.map((row) => [...row]))).toBe(
      topology,
    );
    expect(Object.isFrozen(topology.houses[0])).toBe(true);
    for (let cell = 0; cell < 81; cell++) {
      expect(topology.cellHouses[cell]).toHaveLength(3);
      expect(topology.peers[cell]).toHaveLength(20);
      expect(topology.peers[cell]).not.toContain(cell);
      for (const peer of topology.peers[cell])
        expect(topology.peers[peer]).toContain(cell);
    }
    expect(
      compileTopology(CLASSIC_REGION_MAP, true).cellHouses[40],
    ).toHaveLength(5);
    expect(compileTopology(CLASSIC_REGION_MAP, true).peers[40]).toHaveLength(
      32,
    );
  });
  it('does not reuse stale geometry when the same input object is changed', () => {
    const map = CLASSIC_REGION_MAP.map((row) => [...row]),
      before = compileTopology(map);
    for (const row of map)
      for (let c = 0; c < 9; c++)
        row[c] = row[c] === 0 ? 1 : row[c] === 1 ? 0 : row[c];
    const after = compileTopology(map);
    expect(after).not.toBe(before);
    expect(before.regions[0]).toBe(0);
    expect(after.regions[0]).toBe(1);
  });
});
describe('deterministic bounded generation', () => {
  it('replays all variants from injected random sources without global random state', async () => {
    for (const type of [
      'Standard 9x9',
      'Irregular 9x9',
      'Diagonal 9x9',
    ] as const) {
      const first = await generateGame('medium', type, {
        random: seededRandom(17),
        now: () => 0,
      });
      const second = await generateGame('medium', type, {
        random: seededRandom(17),
        now: () => 0,
      });
      expect(second).toEqual(first);
    }
  });
  it('rejects infinite/invalid budgets and broken random sources', async () => {
    await expect(
      generateGame('easy', 'Standard 9x9', { maxNodes: Infinity }),
    ).rejects.toThrow(/finite/);
    await expect(
      generateGame('easy', 'Standard 9x9', { timeoutMs: NaN }),
    ).rejects.toThrow(/finite/);
    await expect(
      generateGame('easy', 'Standard 9x9', { random: () => 1 }),
    ).rejects.toThrow(/Random source/);
    let now = 0;
    await expect(
      generateGame('easy', 'Standard 9x9', { timeoutMs: 1, now: () => now++ }),
    ).rejects.toThrow(/search limit/);
  });
});
