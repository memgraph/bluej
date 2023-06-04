export type WeightedItem = { items: any[], weight: number };

/*
this function merges any number of arrays into a single array, distributing the items in a weighted round robin fashion
the weight of each array is determined by the length of the array. This version is based on the WRR implementation in
nginx which is smoother in it's distribution than the WRR implementations generally used

Example:
let arrays: any[][] = [
    ['a1', 'a2', 'a3'], // weight: 3
    ['b1', 'b2'], // weight: 2
    ['c1'], // weight: 1
];
let result = weightedRoundRobin(arrays);
console.log(result);

> ['a1', 'b1', 'a2', 'b2', 'a3', 'c1'].
*/
export function weightedRoundRobin(inputArrays: any[][]): any[] {
    let items: WeightedItem[] = inputArrays.map(arr => ({ items: arr, weight: arr.length }));

    let n = items.length;
    if (n === 0) {
        return [];
    }
    if (n === 1) {
        return items[0].items;
    }

    let gcd = (x: number, y: number): number => {
        let t: number;
        while (true) {
            t = (x % y);
            if (t > 0) {
                x = y;
                y = t;
            } else {
                return y;
            }
        }
    };

    let maxWeight = Math.max(...items.map(i => i.weight));
    let gcdValue = items.reduce((acc, i) => gcd(acc, i.weight), items[0].weight);
    let index = -1;
    let currentWeight = 0;
    let result: any[] = [];

    while (result.length < inputArrays.flat().length) {
        index = (index + 1) % n;
        if (index === 0) {
            currentWeight = currentWeight - gcdValue;
            if (currentWeight <= 0) {
                currentWeight = maxWeight;
                if (currentWeight === 0) {
                    return result;
                }
            }
        }
        if (items[index].weight >= currentWeight && items[index].items.length > 0) {
            result.push(items[index].items.shift());
            items[index].weight--;
        }
    }

    return result;
}
