const { sumOfSquares, Calculator } = require('./utils');
const { add } = require('./math');

function main() {
  console.log(add(1, 2));
  console.log(sumOfSquares(3, 4));
  const calc = new Calculator();
  console.log(calc.compute(5, 6));
}

module.exports = { main };
