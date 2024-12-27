import { ServerSeedHelper, SeedHelper } from "sc-game-base/src/core/helpers";
import { encrypt, decrypt } from "../helpers/crypto-helper";

export class ProvablyFairConsumer {
    constructor(gameData, definition, roundResultPublisher, resultsRepository) {
        this.gameData = gameData;
        this.definition = definition;
        this.roundResultPublisher = roundResultPublisher;
        this.resultsRepository = resultsRepository;

        this.gameData.provablyFair = {};
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

    generateCrashPoint(playerName, clientSeed, roundId) {
        const provablyFair = this.gameData?.provablyFair?.[playerName] ?? {};
        provablyFair.clientSeed = this.validateClientSeed(clientSeed) ? clientSeed : 0;
        provablyFair.finalHash = SeedHelper.getSHA512Hash(provablyFair.serverSeed + clientSeed);
        provablyFair.finalResult = this.definition.generateResult(provablyFair.finalHash);
        provablyFair.roundId = roundId;

        this.gameData.provablyFair[playerName] = provablyFair;

        return provablyFair.finalResult;
    }

    async createResultRecord(playerName, roundId) {
        const record = await this.findResultRecord(roundId);
        if (!record) {
            const provablyFair = this.gameData.provablyFair[playerName];
            await this.resultsRepository.create({
                roundId: roundId,
                clientSeed: provablyFair.clientSeed,
                encryptedServerSeed: encrypt(provablyFair.serverSeed),
                serverSeedHash: provablyFair.serverSeedHash,
                encryptedFinalResult: encrypt(provablyFair.finalResult),
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
