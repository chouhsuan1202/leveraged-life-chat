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

  // Exposure Status
  let exposureRatio = null;
  let exposureStatus = 'INVALID';
  if (netWorth > 0) {
    exposureRatio = Number((totalExposure / netWorth).toFixed(4));
    const roundedRatio = Number((totalExposure / netWorth).toFixed(2));
    if (roundedRatio < 1.20) {
      exposureStatus = 'UNDER_TARGET';
    } else if (roundedRatio <= 1.50) {
      exposureStatus = 'TARGET_RANGE';
    } else {
      exposureStatus = 'ABOVE_TARGET';
    }
  }

  // Margin Ratio Status
  let marginRatio = null;
  let marginStatus = 'NO_LOAN';
  let maxDropPercent = null;

  if (collateralLoan === 0) {
    marginStatus = 'NO_LOAN';
    maxDropPercent = null;
  } else if (totalPledgedVal === 0) {
    marginRatio = 0;
    marginStatus = 'NO_COLLATERAL';
    maxDropPercent = 0;
  } else {
    marginRatio = Number(((totalPledgedVal / collateralLoan) * 100).toFixed(4));
    const roundedMargin = Number(((totalPledgedVal / collateralLoan) * 100).toFixed(1));
    
    if (roundedMargin < 130) {
      marginStatus = 'MARGIN_CALL';
      maxDropPercent = 0.0;
    } else {
      // 1 - (130 / marginRatioNum)
      const rawDrop = (1 - (1.3 / (totalPledgedVal / collateralLoan))) * 100;
      maxDropPercent = Number(rawDrop.toFixed(1));

      if (roundedMargin < 150) {
        marginStatus = 'WARNING';
      } else if (roundedMargin < 200) {
        marginStatus = 'ALERT';
      } else {
        marginStatus = 'SAFE';
      }
    }
  }

  return {
    isValid: true,
    netWorth,
    totalPledgedVal,
    totalStockVal,
    totalExposure,
    totalLiabilities,
    exposureRatio,
    exposureStatus,
    marginRatio,
    marginStatus,
    maxDropPercent
  };
}
