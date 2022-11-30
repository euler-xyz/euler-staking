# euler-staking

This repo contains the staking smart contracts based on [Synthetix](https://github.com/Synthetixio/synthetix) to be used on [Euler](https://www.euler.finance/).

## Setup

    yarn

## Testing

    npx hardhat test

## Contract modifications:
1. Solidity compiler set to ^0.8.0 which required some syntactic changes 
2. Got rid of `SafeMath` and `SafeDecimalMath` libraries throughout the smart contracts
3. In `RewardsDistribution.sol` got rid of `RewardEscrow` and `FeePoolProxy` references along with related functionalities. Modified contract to enforce success on every `notifyRewardAmount()` call (it means that each staking contract must implement `RewardsDistributionRecipient.sol`)
4. In `StakingRewards.sol` used own safe transfer functions instead of keeping OpenZeppelin dependencies. `rewardsToken` and `stakingToken` variables have been changed to immutables. `notifyRewardAmount()` has been modified so that it's not possible to to add more rewards before current staking period is over (prevents from calling the function multiple times and draining `RewardsDistribution` contract)
5. In `IRewardsDistribution.sol` and `IStakingRewards.sol` removed unnecessary view functions for public variables
6. Added Euler sub-accounts support. For that functions `stake()`, `withdraw()` and `exit()` functions of `StakingRewards.sol` were overloaded
