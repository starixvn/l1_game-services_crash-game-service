const Actions = {
    Bet: "bet",
    CashOut: "cashOut",
    HalfCashOut: "halfCashOut",
    Refund: "refund",
    Crash: "crash",
};

const MinMultiplierValue = 1.01;

const MaxDeltaTime = 3000;

const Chips = [
    20_000_000, 5_000_000, 1_000_000, 500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 1,
];

export { Actions, Chips, MaxDeltaTime, MinMultiplierValue };
