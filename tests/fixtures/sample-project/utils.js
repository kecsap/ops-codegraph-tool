const { add, square } = require('./math');

function sumOfSquares(a, b) {
  return add(square(a), square(b));
}

class Calculator {
  compute(x, y) {
    return sumOfSquares(x, y);
  }
}

module.exports = { sumOfSquares, Calculator };
