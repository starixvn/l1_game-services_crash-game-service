export function roundFloat(+number, fractionDigits = 2) {
    return parseFloat(number.toFixed(fractionDigits));
}
