import { ParallelQueriesOutput } from "./parralel-queries"

export type WeightedItem = { items: any[], weight: number };

type Element = ParallelQueriesOutput;

export function sortByHourAge(entries: ParallelQueriesOutput[]): ParallelQueriesOutput[] {
    const zeroHourAgeEntries = entries.filter((entry) => entry.hour_age === 0);
    const nonZeroHourAgeEntries = entries.filter((entry) => entry.hour_age !== 0);
    return [...zeroHourAgeEntries, ...nonZeroHourAgeEntries];
}

export function deduplicateArray(arr: ParallelQueriesOutput[]): ParallelQueriesOutput[] {
    const idSet = new Set<number>();
    return arr.filter((obj) => {
        if (idSet.has(obj.id)) {
            return false;
        }
        idSet.add(obj.id);
        return true;
    });
}

export function weightedRoundRobin(...arrays: Element[][]): Element[] {
    const result: Element[] = [];
    const arraysLengths = arrays.map(arr => arr.length);
    const maxCount = Math.max(...arraysLengths);

    for (let i = 0; i < maxCount; i++) {
        for (let arrIndex = 0; arrIndex < arrays.length; arrIndex++) {
            const arr = arrays[arrIndex];
            const weight = arr.length;
            if (i < weight) {
                result.push(arr[i]);
            }
        }
    }
    return result;
}