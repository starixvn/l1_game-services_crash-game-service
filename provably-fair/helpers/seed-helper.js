import crypto from "crypto";

function getMergeSeed(serverSeed = "", clientSeeds = []) {
    return serverSeed.concat(...clientSeeds);
}

function getSHA256Hash(seed) {
    return crypto.createHash("sha256").update(seed).digest("hex");
}

function getSHA512Hash(seed) {
    return crypto.createHash("sha512").update(seed).digest("hex");
}

export { getMergeSeed, getSHA256Hash, getSHA512Hash };
