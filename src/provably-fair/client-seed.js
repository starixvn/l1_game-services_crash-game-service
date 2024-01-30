import { ClientSeedRange } from "../constants";

export function validateClientSeed(seed) {
    const parsedSeed = parseFloat(seed);
    return Number.isInteger(parsedSeed) && parsedSeed >= ClientSeedRange.min && parsedSeed <= ClientSeedRange.max;
}
