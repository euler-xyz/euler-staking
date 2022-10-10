const et = require('euler-contracts/test/lib/eTestLib.js');

const A_DAY = 24 * 60 * 60

et.testSet({
    desc: "StakingRewards",
    preActions: ctx => [
        { action: 'cb', cb: async () => {
            let factory = await ethers.getContractFactory('RewardsDistribution');

            ctx.contracts.rewardsDistribution = await (await factory.deploy(
                ctx.wallet.address,
                ctx.wallet2.address,
                ctx.contracts.tokens.TST.address,
            )).deployed();

            factory = await ethers.getContractFactory('StakingRewards');

            ctx.contracts.stakingRewards = await (await factory.deploy(
                ctx.wallet.address,
                ctx.contracts.rewardsDistribution.address,
                ctx.contracts.tokens.TST.address,
                ctx.contracts.eTokens.eTST.address,
            )).deployed();
        }},

        { send: 'tokens.TST.mint', args: [ctx.wallet.address, et.eth('200')], },
        { send: 'tokens.TST.mint', args: [ctx.wallet3.address, et.eth('100')], },
        { send: 'tokens.TST.mint', args: [ctx.wallet4.address, et.eth('100')], },
        { send: 'tokens.TST.mint', args: [ctx.wallet5.address, et.eth('100')], },
        { from: ctx.wallet3, send: 'tokens.TST.approve', args: [ctx.contracts.euler.address, et.MaxUint256], },
        { from: ctx.wallet4, send: 'tokens.TST.approve', args: [ctx.contracts.euler.address, et.MaxUint256], },
        { from: ctx.wallet5, send: 'tokens.TST.approve', args: [ctx.contracts.euler.address, et.MaxUint256], },
        { from: ctx.wallet3, send: 'eTokens.eTST.deposit', args: [0, et.MaxUint256], },
        { from: ctx.wallet4, send: 'eTokens.eTST.deposit', args: [0, et.MaxUint256], },
        { from: ctx.wallet5, send: 'eTokens.eTST.deposit', args: [0, et.MaxUint256], },

        { action: 'cb', cb: async () => {
            await ctx.contracts.tokens.TST.transfer(ctx.contracts.rewardsDistribution.address, et.eth('100'))
            await ctx.contracts.rewardsDistribution.addRewardDistribution(ctx.contracts.stakingRewards.address, et.eth('1'))
        }},
    ],
})

.test({
    desc: "should set constructor params on deployment",
    actions: ctx => [
        { call: 'stakingRewards.owner', assertEql: ctx.wallet.address },
        { call: 'stakingRewards.rewardsToken', assertEql: ctx.contracts.tokens.TST.address },
        { call: 'stakingRewards.stakingToken', assertEql: ctx.contracts.eTokens.eTST.address },
        { call: 'stakingRewards.rewardsDistribution', assertEql: ctx.contracts.rewardsDistribution.address },
    ]
})

.test({
    desc: "should revert when non contract owner attempts call onlyOwner functions",
    actions: ctx => [
        { from: ctx.wallet2, send: 'stakingRewards.recoverERC20', args: [ctx.contracts.tokens.TST.address, et.eth('1')], 
            expectError: 'Only the contract owner may perform this action',
        },
        { from: ctx.wallet2, send: 'stakingRewards.setRewardsDuration', args: [1], 
            expectError: 'Only the contract owner may perform this action',
        },
        { from: ctx.wallet2, send: 'stakingRewards.setPaused', args: [false], 
            expectError: 'Only the contract owner may perform this action',
        },
        { from: ctx.wallet2, send: 'stakingRewards.setRewardsDistribution', args: [ctx.contracts.tokens.TST.address], 
            expectError: 'Only the contract owner may perform this action',
        },
    ]
})

.test({
    desc: "should revert when non rewards distribution contract attempts call onlyRewardsDistribution functions",
    actions: ctx => [
        { from: ctx.wallet2, send: 'stakingRewards.notifyRewardAmount', args: [et.eth('1')], 
            expectError: "Caller is not RewardsDistribution contract",
        },
    ]
})

.test({
    desc: "should have Owned functionality",
    actions: ctx => [
        { from: ctx.wallet2, send: 'stakingRewards.nominateNewOwner', args: [ctx.wallet2.address], 
            expectError: 'Only the contract owner may perform this action',
        },
        { from: ctx.wallet, send: 'stakingRewards.nominateNewOwner', args: [ctx.wallet2.address], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('OwnerNominated');
                et.expect(logs[0].args.newOwner).to.equal(ctx.wallet2.address);
            }
        },
        { from: ctx.wallet3, send: 'stakingRewards.acceptOwnership', 
            expectError: "You must be nominated before you can accept ownership",
        },
        { from: ctx.wallet2, send: 'stakingRewards.acceptOwnership',
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('OwnerChanged');
                et.expect(logs[0].args.oldOwner).to.equal(ctx.wallet.address);
                et.expect(logs[0].args.newOwner).to.equal(ctx.wallet2.address);
            }
        },
        { from: ctx.wallet2, send: 'stakingRewards.nominateNewOwner', args: [ctx.wallet3.address], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('OwnerNominated');
                et.expect(logs[0].args.newOwner).to.equal(ctx.wallet3.address);
            }
        },
    ]
})

.test({
    desc: "should have Pausable functionality",
    actions: ctx => [
        { from: ctx.wallet3, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },
        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [et.eth('1')], },

        { from: ctx.wallet, send: 'stakingRewards.setPaused', args: [true], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('PauseChanged');
                et.expect(logs[0].args.isPaused).to.equal(true);
            }
        },
        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [et.eth('1')], 
            expectError: "This action cannot be performed while the contract is paused",
        },

        { from: ctx.wallet, send: 'stakingRewards.setPaused', args: [false], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('PauseChanged');
                et.expect(logs[0].args.isPaused).to.equal(false);
            }
        },
        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [et.eth('1')], },
    ]
})

.test({
    desc: "should revert if recovering staking token",
    actions: ctx => [
        { send: 'stakingRewards.recoverERC20', args: [ctx.contracts.eTokens.eTST.address, 0],
            expectError: 'Cannot withdraw the staking token',
        },
    ]
})

.test({
    desc: "should retrieve external token from StakingRewards",
    actions: ctx => [
        { send: 'tokens.TST.transfer', args: [ctx.contracts.stakingRewards.address, et.eth('1')], },
        { call: 'tokens.TST.balanceOf', args: [ctx.wallet.address], assertEql:  et.eth('99') },
        { call: 'tokens.TST.balanceOf', args: [ctx.contracts.stakingRewards.address], assertEql:  et.eth('1') },

        { send: 'stakingRewards.recoverERC20', args: [ctx.contracts.tokens.TST.address, et.eth('1')],
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('Recovered');
                et.expect(logs[0].args.token).to.equal(ctx.contracts.tokens.TST.address);
                et.expect(logs[0].args.amount).to.equal(et.eth('1'));
            }
        },
        { call: 'tokens.TST.balanceOf', args: [ctx.wallet.address], assertEql:  et.eth('100') },
        { call: 'tokens.TST.balanceOf', args: [ctx.contracts.stakingRewards.address], assertEql:  et.eth('0') },
    ]
})

.test({
    desc: "lastTimeRewardApplicable",
    actions: ctx => [
        { call: 'stakingRewards.lastTimeRewardApplicable', assertEql: 0 },

        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },

        { call: 'stakingRewards.lastTimeRewardApplicable', 
            onResult: async (r) => {
                et.expect(r).to.equal(await ctx.lastBlockTimestamp());
                ctx.cache = await ctx.contracts.stakingRewards.periodFinish()
            }
        },

        { action: 'jumpTimeAndMine', time: 7 * A_DAY + 1000, },
        { call: 'stakingRewards.lastTimeRewardApplicable', 
            onResult: async (r) => {
                et.expect(r).to.equal(ctx.cache);
            }
        },
    ]
})

.test({
    desc: "rewardPerToken",
    actions: ctx => [
        { call: 'stakingRewards.rewardPerToken', assertEql: 0 },

        { from: ctx.wallet3, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },
        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [et.eth('2')], },
        { call: 'stakingRewards.totalSupply', assertEql: et.eth('2') },

        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },
        { action: 'jumpTimeAndMine', time: A_DAY, },

        { call: 'stakingRewards.rewardPerToken', equals: [et.BN(A_DAY).mul(et.eth('1')).div(7 * A_DAY).mul(et.eth('1')).div(et.eth('2')), 1e-4] },
    ]
})

.test({
    desc: "staking",
    actions: ctx => [
        { from: ctx.wallet3, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },
        { from: ctx.wallet4, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },
        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [0], expectError: 'Cannot stake 0',},

        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet3.address], equals:  [et.eth('100'), 1e-6] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet4.address], equals:  [et.eth('100'), 1e-6] },
        { call: 'stakingRewards.balanceOf', args: [ctx.wallet3.address], assertEql:  et.eth('0') },
        { call: 'stakingRewards.balanceOf', args: [ctx.wallet4.address], assertEql:  et.eth('0') },
        { call: 'stakingRewards.totalSupply', assertEql: et.eth('0') },

        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [et.eth('1')], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('Staked');
                et.expect(logs[0].args.user).to.equal(ctx.wallet3.address);
                et.expect(logs[0].args.amount).to.equal(et.eth('1'));
            }
        },

        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet3.address], equals:  [et.eth('99'), 1e-6] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet4.address], equals:  [et.eth('100'), 1e-6] },
        { call: 'stakingRewards.balanceOf', args: [ctx.wallet3.address], equals:  [et.eth('1'), 1e-6] },
        { call: 'stakingRewards.balanceOf', args: [ctx.wallet4.address], assertEql:  et.eth('0') },
        { call: 'stakingRewards.totalSupply', equals:  [et.eth('1'), 1e-6] },

        { from: ctx.wallet4, send: 'stakingRewards.stake', args: [et.eth('5')], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('Staked');
                et.expect(logs[0].args.user).to.equal(ctx.wallet4.address);
                et.expect(logs[0].args.amount).to.equal(et.eth('5'));
            }
        },

        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet3.address], equals:  [et.eth('99'), 1e-6] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet4.address], equals:  [et.eth('95'), 1e-6] },
        { call: 'stakingRewards.balanceOf', args: [ctx.wallet3.address], equals:  [et.eth('1'), 1e-6] },
        { call: 'stakingRewards.balanceOf', args: [ctx.wallet4.address], equals:  [et.eth('5'), 1e-6] },
        { call: 'stakingRewards.totalSupply', equals:  [et.eth('6'), 1e-6] },
    ]
})

.test({
    desc: "earning",
    actions: ctx => [
        { from: ctx.wallet3, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },
        { call: 'stakingRewards.earned', args: [ctx.wallet3.address], assertEql: 0 },

        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [et.eth('5')], },
        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },
        { call: 'stakingRewards.rewardRate', equals: [et.eth('1').div(7 * A_DAY), 1e-6] },
        { call: 'stakingRewards.getRewardForDuration', equals: [et.eth('1'), 1e-6] },
        { action: 'jumpTimeAndMine', time: A_DAY, },

        { call: 'stakingRewards.earned', args: [ctx.wallet3.address], 
            equals:  [et.eth('5').mul(et.BN(A_DAY)).mul(et.eth('1')).div(7 * A_DAY).mul(et.eth('1')).div(et.eth('5')).div(et.eth('1')), 1e-4]
        },

        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },
        { call: 'stakingRewards.rewardRate', equals: [et.eth('1').div(7 * A_DAY).mul(6 * A_DAY).add(et.eth('1')).div(7 * A_DAY), 1e-4] },
        { call: 'stakingRewards.getRewardForDuration', equals: [et.eth('1').div(7 * A_DAY).mul(6 * A_DAY).add(et.eth('1')), 1e-4] },
    ]
})

.test({
    desc: "earnings roll over after rewardsDuration",
    actions: ctx => [
        { from: ctx.wallet3, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },
        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [et.eth('5')], },

        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },
        { action: 'jumpTimeAndMine', time: 7 * A_DAY, },

        { call: 'stakingRewards.earned', args: [ctx.wallet3.address], 
        },

        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },
        { action: 'jumpTimeAndMine', time: 7 * A_DAY, },

        { call: 'stakingRewards.earned', args: [ctx.wallet3.address], 
            equals:  [et.eth('2'), 1e-4]
        },
    ]
})

.test({
    desc: "gets reward",
    actions: ctx => [
        { from: ctx.wallet3, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },
        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },
        
        { call: 'tokens.TST.balanceOf', args: [ctx.wallet3.address], assertEql: 0 },
        { call: 'tokens.TST.balanceOf', args: [ctx.contracts.stakingRewards.address], assertEql: et.eth('1') },
        { from: ctx.wallet3, send: 'stakingRewards.getReward', 
            onLogs: logs => {
                et.expect(logs.length).to.equal(0);
            }
        },

        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [et.eth('5')], },        
        { call: 'stakingRewards.rewardRate', equals: [et.eth('1').div(7 * A_DAY), 1e-6] },
        { action: 'jumpTimeAndMine', time: A_DAY, },

        { call: 'tokens.TST.balanceOf', args: [ctx.wallet3.address], assertEql: 0 },
        { call: 'tokens.TST.balanceOf', args: [ctx.contracts.stakingRewards.address], assertEql: et.eth('1') },
        { from: ctx.wallet3, send: 'stakingRewards.getReward', 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('RewardPaid');
                et.expect(logs[0].args.user).to.equal(ctx.wallet3.address);

                const tolerance = ethers.utils.parseEther('' + 1e-4);
                const difference = logs[0].args.reward.sub(et.eth('1').div(7)).abs();
                if (difference.gt(tolerance)) et.assert(false);
            }
        },
        { call: 'tokens.TST.balanceOf', args: [ctx.wallet3.address], equal: [et.eth('1').div(7), 1e-4] },
        { call: 'tokens.TST.balanceOf', args: [ctx.contracts.stakingRewards.address], equal: [et.eth('1').mul(6).div(7), 1e-4] },
    ]
})

.test({
    desc: "withdrawal",
    actions: ctx => [
        { from: ctx.wallet3, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },
        { from: ctx.wallet3, send: 'stakingRewards.withdraw', args: [0], expectError: 'Cannot withdraw 0' },
        { from: ctx.wallet3, send: 'stakingRewards.withdraw', args: [1], expectError: 'panic code 0x11' },

        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [et.eth('5')], },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet3.address], equal: [et.eth('95'), 1e-4] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.contracts.stakingRewards.address], equal: [et.eth('5'), 1e-4] },

        { from: ctx.wallet3, send: 'stakingRewards.withdraw', args: [et.eth('2')],
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('Withdrawn');
                et.expect(logs[0].args.user).to.equal(ctx.wallet3.address);

                const tolerance = ethers.utils.parseEther('' + 1e-4);
                const difference = logs[0].args.amount.sub(et.eth('2')).abs();
                if (difference.gt(tolerance)) et.assert(false);
            }
        },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet3.address], equal: [et.eth('97'), 1e-4] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.contracts.stakingRewards.address], equal: [et.eth('3'), 1e-4] },
    ]
})

.test({
    desc: "exit",
    actions: ctx => [
        { from: ctx.wallet3, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },
        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },
        { from: ctx.wallet3, send: 'stakingRewards.exit', expectError: 'Cannot withdraw 0' },

        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [et.eth('5')], },
        { action: 'jumpTimeAndMine', time: A_DAY, },

        { call: 'tokens.TST.balanceOf', args: [ctx.wallet3.address], assertEql: 0 },
        { call: 'tokens.TST.balanceOf', args: [ctx.contracts.stakingRewards.address], assertEql: et.eth('1') },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet3.address], equal: [et.eth('95'), 1e-4] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.contracts.stakingRewards.address], equal: [et.eth('5'), 1e-4] },

        { from: ctx.wallet3, send: 'stakingRewards.exit',
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('Withdrawn');
                et.expect(logs[0].args.user).to.equal(ctx.wallet3.address);

                const tolerance = ethers.utils.parseEther('' + 1e-4);
                let difference = logs[0].args.amount.sub(et.eth('5')).abs();
                if (difference.gt(tolerance)) et.assert(false);

                et.expect(logs[1].name).to.equal('RewardPaid');
                et.expect(logs[1].args.user).to.equal(ctx.wallet3.address);

                difference = logs[1].args.reward.sub(et.eth('1').div(7)).abs();
                if (difference.gt(tolerance)) et.assert(false);
            }
        },
        { call: 'tokens.TST.balanceOf', args: [ctx.wallet3.address], equal: [et.eth('1').div(7), 1e-4] },
        { call: 'tokens.TST.balanceOf', args: [ctx.contracts.stakingRewards.address], equal: [et.eth('1').mul(6).div(7), 1e-4] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet3.address], equal: [et.eth('100'), 1e-4] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.contracts.stakingRewards.address], equal: [et.eth('0'), 1e-4] },
    ]
})

.test({
    desc: "set rewards duration",
    actions: ctx => [
        { call: 'stakingRewards.rewardsDuration', assertEql: 7 * A_DAY },

        { send: 'stakingRewards.setRewardsDuration', args: [3 * A_DAY], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('RewardsDurationUpdated');
                et.expect(logs[0].args.newDuration).to.equal(3 * A_DAY);
            }
        },
        { call: 'stakingRewards.rewardsDuration', assertEql: 3 * A_DAY },

        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },
        { send: 'stakingRewards.setRewardsDuration', args: [A_DAY], 
            expectError: "Previous rewards period must be complete before changing the duration for the new period" 
        },
        { action: 'jumpTimeAndMine', time: A_DAY, },
        { send: 'stakingRewards.setRewardsDuration', args: [A_DAY], 
            expectError: "Previous rewards period must be complete before changing the duration for the new period" 
        },
        { action: 'jumpTimeAndMine', time: 2 * A_DAY, },
        { send: 'stakingRewards.setRewardsDuration', args: [A_DAY], 
            expectError: "Previous rewards period must be complete before changing the duration for the new period" 
        },

        // should be possible after the rewards duration passes
        { action: 'jumpTimeAndMine', time: 1000, },
        { send: 'stakingRewards.setRewardsDuration', args: [A_DAY], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('RewardsDurationUpdated');
                et.expect(logs[0].args.newDuration).to.equal(A_DAY);
            }
        },
        { call: 'stakingRewards.rewardsDuration', assertEql: A_DAY },

        // should be possible after the rewards duration passes
        { action: 'jumpTimeAndMine', time: 1.01 * A_DAY, },
        { send: 'stakingRewards.setRewardsDuration', args: [1], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('RewardsDurationUpdated');
                et.expect(logs[0].args.newDuration).to.equal(1);
            }
        },
        { call: 'stakingRewards.rewardsDuration', assertEql: 1 },
    ]
})

.test({
    desc: "notify reward amount",
    actions: ctx => [
        { send: 'stakingRewards.setRewardsDistribution', args: [ctx.wallet.address], },
        { send: 'stakingRewards.setRewardsDuration', args: [1], },

        { send: 'stakingRewards.notifyRewardAmount', args: [et.eth('1')], expectError: "Provided reward too high" },

        { send: 'tokens.TST.transfer', args: [ctx.contracts.stakingRewards.address, et.eth('1')], },
        { send: 'stakingRewards.notifyRewardAmount', args: [et.eth('1')], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('RewardAdded');
                et.expect(logs[0].args.reward).to.equal(et.eth('1'));
            }
        },
        { call: 'stakingRewards.rewardRate', assertEql: et.eth('1') },
    ]
})

.test({
    desc: "integration test",
    actions: ctx => [
        { send: 'stakingRewards.setRewardsDuration', args: [10 * A_DAY], },
        { from: ctx.wallet3, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },
        { from: ctx.wallet4, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },
        { from: ctx.wallet5, send: 'eTokens.eTST.approve', args: [ctx.contracts.stakingRewards.address, et.MaxUint256], },

        // two wallets stake the same amount
        { from: ctx.wallet3, send: 'stakingRewards.stake', args: [et.eth('1')], },
        { from: ctx.wallet4, send: 'stakingRewards.stake', args: [et.eth('1')], },

        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },
        
        // they should earn the same amount
        { action: 'jumpTimeAndMine', time: A_DAY, },
        { call: 'stakingRewards.earned', args: [ctx.wallet3.address], equals: [et.eth('1').div(10).div(2), 1e-4] },
        { call: 'stakingRewards.earned', args: [ctx.wallet4.address], equals: [et.eth('1').div(10).div(2), 1e-4] },

        { action: 'jumpTimeAndMine', time: 2 * A_DAY, },
        { call: 'stakingRewards.earned', args: [ctx.wallet3.address], equals: [et.eth('1').div(10).mul(3).div(2), 1e-4] },
        { call: 'stakingRewards.earned', args: [ctx.wallet4.address], equals: [et.eth('1').div(10).mul(3).div(2), 1e-4] },

        // third wallet comes in the middle of the rewards duration. second wallet adds to the stake
        { action: 'jumpTimeAndMine', time: 2 * A_DAY, },
        { from: ctx.wallet4, send: 'stakingRewards.stake', args: [et.eth('1')], },
        { from: ctx.wallet5, send: 'stakingRewards.stake', args: [et.eth('2')], },

        { action: 'jumpTimeAndMine', time: 5 * A_DAY, },
        { call: 'stakingRewards.earned', args: [ctx.wallet3.address], equals: [et.eth('0.35'), 1e-4] },
        { call: 'stakingRewards.earned', args: [ctx.wallet4.address], equals: [et.eth('0.45'), 1e-4] },
        { call: 'stakingRewards.earned', args: [ctx.wallet5.address], equals: [et.eth('0.20'), 1e-4] },

        // first wallet leaves, new period begins
        { from: ctx.wallet3, send: 'stakingRewards.exit', },
        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },
        { action: 'jumpTimeAndMine', time: 10 * A_DAY, },

        // second wallet gets rewards, new period begins
        { from: ctx.wallet4, send: 'stakingRewards.getReward', },
        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], },
        
        { action: 'jumpTimeAndMine', time: 10 * A_DAY, },
        { from: ctx.wallet4, send: 'stakingRewards.exit', },
        { from: ctx.wallet5, send: 'stakingRewards.exit', },
        { call: 'tokens.TST.balanceOf', args: [ctx.wallet3.address], equal: [et.eth('0.35'), 1e-4] },
        { call: 'tokens.TST.balanceOf', args: [ctx.wallet4.address], equal: [et.eth('1.45'), 1e-4] },
        { call: 'tokens.TST.balanceOf', args: [ctx.wallet5.address], equal: [et.eth('1.20'), 1e-4] },
        { call: 'tokens.TST.balanceOf', args: [ctx.contracts.stakingRewards.address], equal: [et.eth('0'), 1e-4] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet3.address], equal: [et.eth('100'), 1e-4] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet4.address], equal: [et.eth('100'), 1e-4] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.wallet5.address], equal: [et.eth('100'), 1e-4] },
        { call: 'eTokens.eTST.balanceOf', args: [ctx.contracts.stakingRewards.address], equal: [et.eth('0'), 1e-4] },
    ]
})

.run();
