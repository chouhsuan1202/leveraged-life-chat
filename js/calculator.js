/**
 * Pure Financial Leverage & Risk Calculator (Standard ES Module)
 */

export function parseInput(val) {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(val);
  if (isNaN(num) || !isFinite(num) || num < 0) {
    throw new Error(`Invalid numeric input: ${val}`);
  }
  return num;
}

/**
 * 1. DBR 22 Limit Calculation
 * @param {number} monthlyIncome 
 * @param {number} unsecuredDebt 
 */
export function calculateDbrLimit(monthlyIncome, unsecuredDebt = 0) {
  const inc = parseInput(monthlyIncome);
  const debt = parseInput(unsecuredDebt);
  
  if (inc <= 0) {
    throw new Error('Monthly income must be greater than 0');
  }

  const maxLimit = inc * 22;
  const remainingLimit = Math.max(0, maxLimit - debt);
  
  return {
    maxLimit,
    unsecuredDebt: debt,
    remainingLimit,
    utilizationPercent: Number(((debt / maxLimit) * 100).toFixed(1))
  };
}

/**
 * 2. Maintenance Ratio Calculation
 * @param {number} pledgedValue 
 * @param {number} collateralLoan 
 */
export function calculateMaintenanceRatio(pledgedValue, collateralLoan) {
  const pledged = parseInput(pledgedValue);
  const loan = parseInput(collateralLoan);

  if (loan === 0) {
    return {
      ratio: null,
      status: 'NO_LOAN',
      displayText: '∞ % (無質押借款)'
    };
  }

  if (pledged === 0) {
    return {
      ratio: 0,
      status: 'NO_COLLATERAL',
      displayText: '0.0 % (無擔保品)'
    };
  }

  const ratio = Number(((pledged / loan) * 100).toFixed(1));
  let status = 'SAFE';
  if (ratio < 130) {
    status = 'MARGIN_CALL';
  } else if (ratio < 150) {
    status = 'WARNING';
  } else if (ratio < 200) {
    status = 'ALERT';
  }

  return {
    ratio,
    status,
    displayText: `${ratio.toFixed(1)} %`
  };
}

/**
 * 3. Static Price Drop to Threshold Calculation
 * @param {number} currentRatio 
 * @param {number} threshold 
 */
export function calculateStaticDropToThreshold(currentRatio, threshold = 130) {
  const cur = parseInput(currentRatio);
  const thresh = parseInput(threshold);

  if (cur <= 0 || cur < thresh) {
    return {
      dropPercent: 0.0,
      isTriggered: true
    };
  }

  // Formula: 1 - (threshold / currentRatio)
  const drop = (1 - (thresh / cur)) * 100;
  return {
    dropPercent: Number(drop.toFixed(1)),
    isTriggered: false
  };
}

/**
 * 4. Effective Leverage Exposure Calculation
 * @param {number} pledged1x 
 * @param {number} pledged2x 
 * @param {number} unpledged1x 
 * @param {number} unpledged2x 
 * @param {number} netWorth 
 */
export function calculateEffectiveExposure(pledged1x = 0, pledged2x = 0, unpledged1x = 0, unpledged2x = 0, netWorth = 0) {
  const p1 = parseInput(pledged1x);
  const p2 = parseInput(pledged2x);
  const u1 = parseInput(unpledged1x);
  const u2 = parseInput(unpledged2x);
  const nw = Number(netWorth);

  const total1x = p1 + u1;
  const total2x = p2 + u2;
  const totalStockVal = p1 + p2 + u1 + u2;
  const totalExposure = total1x + (total2x * 2);

  let exposureRatio = null;
  let status = 'INVALID';

  if (nw > 0) {
    exposureRatio = Number((totalExposure / nw).toFixed(2));
    if (exposureRatio < 1.20) {
      status = 'UNDER_TARGET';
    } else if (exposureRatio <= 1.50) {
      status = 'TARGET_RANGE';
    } else {
      status = 'ABOVE_TARGET';
    }
  }

  return {
    total1x,
    total2x,
    totalStockVal,
    totalExposure,
    netWorth: nw,
    exposureRatio,
    status
  };
}

/**
 * Complete Full Portfolio Leverage Calculation
 * @param {Object} inputs 
 */
export function calculateLeverage(inputs) {
  const pledged1x = parseInput(inputs.pledged1x);
  const pledged2x = parseInput(inputs.pledged2x);
  const unpledged1x = parseInput(inputs.unpledged1x);
  const unpledged2x = parseInput(inputs.unpledged2x);
  const collateralLoan = parseInput(inputs.collateralLoan);
  const creditLoan = parseInput(inputs.creditLoan);
  const cashReserve = parseInput(inputs.cashReserve);

  const totalPledgedVal = pledged1x + pledged2x;
  const totalStockVal = totalPledgedVal + unpledged1x + unpledged2x;
  const totalExposure = (pledged1x + unpledged1x) + ((pledged2x + unpledged2x) * 2);
  const totalLiabilities = collateralLoan + creditLoan;
  const netWorth = totalStockVal + cashReserve - totalLiabilities;

  // Exposure
  const expRes = calculateEffectiveExposure(pledged1x, pledged2x, unpledged1x, unpledged2x, netWorth);
  
  // Margin
  const marginRes = calculateMaintenanceRatio(totalPledgedVal, collateralLoan);
  const dropRes = marginRes.ratio !== null ? calculateStaticDropToThreshold(marginRes.ratio, 130) : { dropPercent: null };

  return {
    isValid: true,
    netWorth,
    totalPledgedVal,
    totalStockVal,
    totalExposure,
    totalLiabilities,
    exposureRatio: expRes.exposureRatio,
    exposureStatus: expRes.status,
    marginRatio: marginRes.ratio,
    marginStatus: marginRes.status,
    maxDropPercent: dropRes.dropPercent
  };
}
