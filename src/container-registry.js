import awilix from "awilix";
import { Table } from "sc-game-base";
import { MaxCombinedClientSeeds } from "./constants";
import {
    CashOutConsumer,
    InGameConsumer,
    PlaceBetConsumer,
    SettleCashOutConsumer,
    SettleGameRoundConsumer,
    UnsettledRoundConsumer,
    MineConsumer,
    ProvablyFairConsumer,
    GameResultServiceConsumer,
    UserDisconnectConsumer,
} from "./consumers";
import Bot from "./crons/bot";
import GameCrons from "./crons/game-crons";
import ProcessBetQueue from "./crons/process-bet-queue";
import { LiveGamePublisher, PlaceBetPublisher, RoundResultPublisher, UserBetResultPublisher } from "./event-publishers";
import { BetLogs, Bets, Results, Rounds, tempBetLogs, tempBets, umInfo } from "./models";
import { HttpRouter, SocketRouter } from "./routers";
import UmInfoWatcher from "./watchers/um-info-watcher";
import { HistoryQuery } from "./query-apis";

const { asClass, asValue } = awilix;

export default class ContainerRegistry extends Table.TableContainerRegistry {
    register(appConfigs, definition, gameData) {
        super.register(appConfigs, definition, gameData);
        this.registerWatchers();
        this.registerPFSettings();

        return this.container;
    }

    registerPFSettings() {
        this.container.register({
            maxCombinedClientSeeds: asValue(MaxCombinedClientSeeds),
        });
    }

    registerWatchers() {
        this.container.register({
            umInfoWatcher: asClass(UmInfoWatcher).singleton(),
        });
    }

    registerModels() {
        const definition = this.container.resolve("definition");
        super.registerModels();

        this.container.register({
            roundsRepository: asValue(Rounds(definition.configName)),
            betsRepository: asValue(Bets(definition.configName)),
            resultsRepository: asValue(Results(definition.configName)),
            betLogsRepository: asValue(BetLogs(definition.configName)),
            tempBetsRepository: asValue(tempBets(definition.configName)),
            tempBetLogsRepository: asValue(tempBetLogs(definition.configName)),
            umInfoRepository: asValue(umInfo()),
        });
    }

    registerConsumers() {
        super.registerConsumers();

        this.container.register({
            mineConsumer: asClass(MineConsumer).singleton(),
            inGameConsumer: asClass(InGameConsumer).singleton(),
            placeBetConsumer: asClass(PlaceBetConsumer).singleton(),
            cashOutConsumer: asClass(CashOutConsumer).singleton(),
            settleGameRoundConsumer: asClass(SettleGameRoundConsumer).singleton().proxy(),
            settleCashOutConsumer: asClass(SettleCashOutConsumer).singleton(),
            unsettledRoundConsumer: asClass(UnsettledRoundConsumer).singleton().proxy(),
            provablyFairConsumer: asClass(ProvablyFairConsumer).singleton(),
            gameResultServiceConsumer: asClass(GameResultServiceConsumer).singleton().proxy(),
            userDisconnectConsumer: asClass(UserDisconnectConsumer).singleton(),
        });
    }

    registerPublishers() {
        super.registerPublishers();

        this.container.register({
            liveGamePublisher: asClass(LiveGamePublisher).singleton(),
            placeBetPublisher: asClass(PlaceBetPublisher).singleton(),
            userBetResultPublisher: asClass(UserBetResultPublisher).singleton(),
            roundResultPublisher: asClass(RoundResultPublisher).singleton(),
        });
    }

    registerCrons() {
        super.registerCrons();

        this.container.register({
            gameCron: asClass(GameCrons).singleton().proxy(),
            processBetQueue: asClass(ProcessBetQueue).singleton().proxy(),
            bot: asClass(Bot).singleton(),
        });
    }

    registerRouters() {
        super.registerRouters();

        this.container.register({
            socketRouter: asClass(SocketRouter).proxy(),
            httpRouter: asClass(HttpRouter),
        });
    }

    registerApis() {
        super.registerApis();

        this.container.register({
            historyQuery: asClass(HistoryQuery).singleton(),
        });
    }
}
