export type FirstPaymentMode = 'customer' | 'platform'

export interface LiquidityPackageInput {
  totalProductPrice: number
  customerTransfer: number
  firstPayment: number
  firstPaymentMode: FirstPaymentMode
  investorPercentage?: number
  applicationPercentage?: number
  ownerPercentage?: number
  adjustmentAmount?: number
}

export interface LiquidityPackageCalculation {
  investorShare: number
  applicationShare: number
  ownerShare: number
  platformFirstPayment: number
  customerTransfer: number
  capitalUsed: number
  adjustmentAmount: number
  investorNetProfit: number
  investorWalletReturn: number
  isBalanced: boolean
  difference: number
}

const money = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

export function calculateLiquidityPackage(
  input: LiquidityPackageInput,
): LiquidityPackageCalculation {
  const investorPercentage = Number(input.investorPercentage ?? 70)
  const applicationPercentage = Number(input.applicationPercentage ?? 20)
  const ownerPercentage = Number(input.ownerPercentage ?? 10)

  const totalProductPrice = Number(input.totalProductPrice || 0)
  const customerTransfer = Number(input.customerTransfer || 0)
  const firstPayment = Number(input.firstPayment || 0)
  const adjustmentAmount = Number(input.adjustmentAmount || 0)

  const platformFirstPayment =
    input.firstPaymentMode === 'platform' ? firstPayment : 0

  const investorShare = money(
    (totalProductPrice * investorPercentage) / 100,
  )

  const applicationShare = money(
    (totalProductPrice * applicationPercentage) / 100,
  )

  const ownerShare = money(
    (totalProductPrice * ownerPercentage) / 100,
  )

  const capitalUsed = money(
    customerTransfer +
      platformFirstPayment +
      adjustmentAmount,
  )

  const investorNetProfit = money(
    investorShare - capitalUsed,
  )

  const investorWalletReturn = money(
    capitalUsed + investorNetProfit,
  )

  const difference = money(
    totalProductPrice -
      investorShare -
      applicationShare -
      ownerShare,
  )

  return {
    investorShare,
    applicationShare,
    ownerShare,
    platformFirstPayment,
    customerTransfer: money(customerTransfer),
    capitalUsed,
    adjustmentAmount: money(adjustmentAmount),
    investorNetProfit,
    investorWalletReturn,
    isBalanced:
      Math.abs(difference) < 0.01 &&
      investorNetProfit >= 0,
    difference,
  }
}
