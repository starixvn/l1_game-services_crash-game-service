import Chance from "chance";
import randomLib1 from "random";
import { Random, MersenneTwister19937 } from "random-js";
import _ from "lodash";
import randomInteger from "random-int";

const MinRandomValue = 1;

// reach max
function random1(max) {
    const chance = new Chance();
    return chance.natural({ min: MinRandomValue, max: max });
}

function random2(max) {
    const chance = new Chance();
    return chance.integer({ min: MinRandomValue, max: max });
}

function random3(max) {
    return randomLib1.int(MinRandomValue, max);
}

function random4(max) {
    const randomJs = new Random(MersenneTwister19937.autoSeed());
    return randomJs.integer(MinRandomValue, max);
}

function random5(max) {
    return _.random(MinRandomValue, max);
}

function random6(max) {
    return randomInteger(MinRandomValue, max);
}

const randomModes = {
    1: [random1, random2, random3, random4, random5],
    2: [random2, random3, random6],
    3: [random6, random5],
};

const generateResult = (randomMode, maxMultiplier = 2 ** 16) => {
    const randomFunctions = randomModes[randomMode] || randomModes[1];
    const chance = new Chance();
    const randomFunction = chance.pickone(randomFunctions);
    const randomSeed = randomFunction(maxMultiplier - 1);

    if (randomSeed % 33 === 0) {
        return MinRandomValue;
    }

    return Math.floor((100 * maxMultiplier - randomSeed) / (maxMultiplier - randomSeed)) / 100;
};

const getSettlementResult = () => {};

const generateRawResultForHash = (roundResult) => {
    return `{${roundResult}}`;
};

export { generateResult, getSettlementResult, generateRawResultForHash };
