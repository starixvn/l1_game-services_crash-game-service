import crypto from "crypto";
import { CryptoHelper, ServerSeedHelper, SeedHelper } from "sc-game-base/src/core/helpers";

export default class ProvablyFairConsumer {
    constructor(gameData, definition, roundResultPublisher, resultsRepository) {
        this.gameData = gameData;
        this.definition = definition;
        this.roundResultPublisher = roundResultPublisher;
        this.resultsRepository = resultsRepository;
    }

    generateServerSeedAndPublishHash(playerId, playerName) {
        let provablyFair = this.gameData.provablyFair[playerName];

        if (!provablyFair) {
            const { randomMode } = this.gameData.gameConfigs;
            provablyFair = {};
            provablyFair.serverSeed = ServerSeedHelper.generateServerSeed(randomMode);
            provablyFair.serverSeedHash = SeedHelper.getSHA256Hash(provablyFair.serverSeed);

            this.gameData.provablyFair[playerName] = provablyFair;
        }

        this.roundResultPublisher.publishProvablyFair(playerId, provablyFair);
    }

    generateCrashPoint(playerName, clientSeed) {
        const provablyFair = this.gameData.provablyFair[playerName];
        provablyFair.clientSeed = this.validateClientSeed(clientSeed) ? clientSeed : 0;
        provablyFair.finalHash = SeedHelper.getSHA512Hash(provablyFair.serverSeed + clientSeed);
        provablyFair.finalResult = this.definition.generateResult(provablyFair.finalHash);

        return provablyFair.finalResult;
    }

    async createResultRecord(playerName, roundId) {
        const record = await this.findResultRecord(roundId);
        if (!record) {
            const provablyFair = this.gameData.provablyFair[playerName];
            await this.resultsRepository.create({
                roundId: roundId,
                clientSeed: provablyFair.clientSeed,
                encryptedServerSeed: CryptoHelper.encrypt(provablyFair.serverSeed),
                serverSeedHash: provablyFair.serverSeedHash,
                encryptedFinalResult: CryptoHelper.encrypt(provablyFair.finalResult),
                time: new Date(),
            });
        }
    }

    async readResultRecord(playerName, roundId) {
        const record = await this.findResultRecord(roundId);
        const provablyFair = {
            hash: record.hash,
            clientSeed: record.clientSeed,
            finalResult: JSON.parse(decrypt(record.encryptedFinalResult)),
        };
        this.gameData.provablyFair[playerName] = provablyFair;

        return provablyFair.finalResult;
    }

    async findResultRecord(roundId) {
        return this.resultsRepository.findOne({ roundId: roundId }).lean().exec();
    }

    validateClientSeed(clientSeed) {
        return Number.isInteger(parseInt(clientSeed));
    }
}
