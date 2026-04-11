export function getReferralMessage(
  code: string,
  walletAddress: string
): string {
  return `Using Referral ${code} with ${walletAddress}`
}

export function getCreateReferralMessage(
  code: string,
  walletAddress: string
): string {
  return `Creating Referral code ${code} for wallet ${walletAddress}`
}
