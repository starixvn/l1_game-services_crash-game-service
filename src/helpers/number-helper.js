export function roundFloat(number, fractionDigits = 2) {
    return Math.floor(+number * 10 ** fractionDigits) / 10 ** fractionDigits;
}
