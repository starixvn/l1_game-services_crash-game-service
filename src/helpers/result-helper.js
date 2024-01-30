import { roundFloat } from "./number-helper";

const generateResult = (finalHash) => {
    const hexValue = finalHash.slice(0, 8);
    const decimalValue = parseInt(hexValue, 16);
    const floatPoint = (2 ** 32 / (decimalValue + 1)) * (1 - 0.03);

    return Math.min(roundFloat(floatPoint), 2000);
};

const getSettlementResult = () => {};

const generateRawResultForHash = (roundResult) => roundResult;

export { generateResult, getSettlementResult, generateRawResultForHash };
