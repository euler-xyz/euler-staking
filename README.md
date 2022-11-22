# euler-staking

This repo contains the staking smart contracts based on [Synthetix](https://github.com/Synthetixio/synthetix) to be used on [Euler](https://www.euler.finance/).

## Setup

    yarn

## Testing

    npx hardhat test

## Contract modifications:
1. Solidity compiler set to ^0.8.0 which required some syntactic changes 
2. Got rid of `SafeMath` and `SafeDecimalMath` libraries throughout the smart contracts
3. In `RewardsDistribution.sol` got rid of `RewardEscrow` and `FeePoolProxy` references along as related functionalities
4. In `StakingRewards.sol` used own safe transfer functions instead of keeping OpenZeppelin dependencies
5. In `IRewardsDistribution.sol` and `IStakingRewards.sol` removed unnecessary view functions for public variables
6. Added Euler sub-accounts support in `stake()`, `withdraw()` and `exit()` functions of `StakingRewards.sol`
