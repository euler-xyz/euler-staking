// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract MockStakingRewards {
    bool public shouldRevert;
    uint256 public auxiliaryVariable;

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function notifyRewardAmount(uint256 reward) external {
        require(!shouldRevert, "StakingRewards reverted");
        auxiliaryVariable = reward;
    }
}
