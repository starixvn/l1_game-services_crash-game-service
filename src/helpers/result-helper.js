import Chance from "chance";
import cryptoRandomString from "crypto-random-string";
import { Random, MersenneTwister19937 } from "random-js";
import Randomstring from "randomstring";
import { customAlphabet } from "nanoid";
import { roundFloat } from "./number-helper";
import crypto from "crypto";

const Characters = [...Array(26)].reduce(
    (res, _, i) => res.concat([String.fromCharCode(65 + i), String.fromCharCode(97 + i)]),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
);

const nanoid = customAlphabet(Characters.toString().replaceAll(",", ""));

function random1(length) {
    const chance = new Chance();
    return chance.string({ length });
}

function random2(length) {
    const randomJs = new Random(MersenneTwister19937.autoSeed());
    return randomJs.string(length);
}

function random3(length) {
    return Randomstring.generate({ length });
}

function random4(length) {
    return cryptoRandomString({ length, type: "url-safe" });
}

function random5(length) {
    return nanoid(length);
}

function random6(length) {
    const chance = new Chance();

    return chance.pickset(Characters, length).toString().replaceAll(",", "");
}

const randomModes = {
    1: [random1, random2, random3, random4, random5],
    2: [random2, random3, random6],
    3: [random6, random5],
};

const getFinalResult = (serverSeed, clientSeeds = []) => {
    const mergeSeed = clientSeeds.reduce((res, clientSeed) => res + clientSeed, serverSeed);
    const sha512 = crypto.createHash("sha512").update(mergeSeed).digest("hex");

    const hexValue = sha512.slice(0, 8);
    const decimalValue = parseInt(hexValue, 16);
    const floatPoint = (2 ** 32 / (decimalValue + 1)) * (1 - 0.03);

    return Math.min(roundFloat(floatPoint), 2000);
};

const generateResult = (randomMode) => {
    const randomFunctions = randomModes[randomMode] || randomModes[1];
    const chance = new Chance();
    const randomStringFunc = chance.pickone(randomFunctions);

    return randomStringFunc(40);
};

const getSettlementResult = () => {};

const generateRawResultForHash = (roundResult) => {
    return `{${roundResult}}`;
};

export { generateResult, getSettlementResult, generateRawResultForHash, getFinalResult };
