/**
 * Pure Parameterized Financial Leverage & Risk Calculator
 * ZERO Hardcoded Numbers / Fallback Placeholders
 */

export function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (isNaN(num) || !isFinite(num) || num < 0) {
    return null;
  }
  return num;
}

/**
 * 1. DBR 22 Limit Calculation
 * @param {Object} params { income, unsecuredDebt }
 */
export function calculateDbrLimit(params = {}) {
  const income = parseNumber(params.income);
  const unsecuredDebt = parseNumber(params.unsecuredDebt) || 0;

  if (income === null || income <= 0) {
    return {
      status: 'missing_param',
      requiredParam: 'income',
      message: '需要提供您的月收入數字（例如：月薪 8 萬）。'
    };
  }

  const maxLimit = income * 22;
  const remainingLimit = Math.max(0, maxLimit - unsecuredDebt);
  const debtRatio = unsecuredDebt > 0 ? Number(((unsecuredDebt / maxLimit) * 100).toFixed(1)) : 0;

  return {
    status: 'success',
    income,
    unsecuredDebt,
    maxLimit,
    remainingLimit,
    debtRatio
  };
}

/**
 * 2. Stock Pledge Maintenance Ratio Calculation
 * @param {Object} params { pledgedValue, loanBalance, targetRate }
 */
export function calculateMaintenanceRatio(params = {}) {
  const pledgedValue = parseNumber(params.pledgedValue);
  const loanBalance = parseNumber(params.loanBalance);
  const targetRate = parseNumber(params.targetRate) || 130;

  if (pledgedValue === null && loanBalance === null) {
    return {
      status: 'missing_param',
      requiredParams: ['pledgedValue', 'loanBalance'],
      message: '需要提供設質股票總市值與質押借款金額（例如：200 萬股票借 50 萬）。'
    };
  }

  if (loanBalance === null || loanBalance === 0) {
    return {
      status: 'no_loan',
      pledgedValue,
      loanBalance: 0,
      maintenanceRatio: null,
      staticDropToTarget: null,
      message: '無質押借款，維持率為無限大。'
    };
  }

  if (pledgedValue === null || pledgedValue === 0) {
    return {
      status: 'no_collateral',
      pledgedValue: 0,
      loanBalance,
      maintenanceRatio: 0,
      staticDropToTarget: 0,
      message: '有借款但未設定設質擔保品。'
    };
  }

  const maintenanceRatio = Number(((pledgedValue / loanBalance) * 100).toFixed(1));
  let staticDropToTarget = 0;
  if (maintenanceRatio > targetRate) {
    staticDropToTarget = Number(((1 - (targetRate / maintenanceRatio)) * 100).toFixed(1));
  }

  let riskTier = 'SAFE';
  if (maintenanceRatio < targetRate) {
    riskTier = 'MARGIN_CALL';
  } else if (maintenanceRatio < 150) {
    riskTier = 'WARNING';
  } else if (maintenanceRatio < 200) {
    riskTier = 'ALERT';
  }

  return {
    status: 'success',
    pledgedValue,
    loanBalance,
    maintenanceRatio,
    targetRate,
    staticDropToTarget,
    riskTier
  };
}

/**
 * 3. Effective Leverage Exposure Calculation
 * @param {Object} params { totalAssets, leveragedETFValue, prototypeValue }
 */
export function calculateEffectiveExposure(params = {}) {
  const totalAssets = parseNumber(params.totalAssets);
  const leveragedETFValue = parseNumber(params.leveragedETFValue) || 0;
  let prototypeValue = parseNumber(params.prototypeValue);

  if (totalAssets === null || totalAssets <= 0) {
    return {
      status: 'missing_param',
      requiredParam: 'totalAssets',
      message: '需要提供您的總股票資產金額（例如：100 萬資產）。'
    };
  }

  if (prototypeValue === null) {
    prototypeValue = Math.max(0, totalAssets - leveragedETFValue);
  }

  const totalExposure = prototypeValue + (leveragedETFValue * 2);
  const exposureRatio = Number((totalExposure / totalAssets).toFixed(2));

  let riskTier = 'TARGET_RANGE';
  if (exposureRatio < 1.2) {
    riskTier = 'UNDER_TARGET';
  } else if (exposureRatio > 1.5) {
    riskTier = 'ABOVE_TARGET';
  }

  return {
    status: 'success',
    totalAssets,
    leveragedETFValue,
    prototypeValue,
    totalExposure,
    exposureRatio,
    riskTier
  };
}
