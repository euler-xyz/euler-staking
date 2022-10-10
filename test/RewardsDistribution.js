const et = require('euler-contracts/test/lib/eTestLib.js');

const NON_ZERO_ADDRESS = "0x0000000000000000000000000000000000000001"

et.testSet({
    desc: "RewardsDistribution",
    preActions: ctx => [
        { action: 'cb', cb: async () => {
            const factory = await ethers.getContractFactory('RewardsDistribution');

            ctx.contracts.rewardsDistribution = await (await factory.deploy(
                ctx.wallet.address,
                ctx.wallet2.address,
                ctx.contracts.tokens.TST.address,
            )).deployed();
        }},
        { send: 'tokens.TST.mint', args: [ctx.wallet.address, et.eth('100')], },
    ],
})

.test({
    desc: "should set constructor params on deployment",
    actions: ctx => [
        { call: 'rewardsDistribution.owner', assertEql: ctx.wallet.address },
        { call: 'rewardsDistribution.authority', assertEql: ctx.wallet2.address },
        { call: 'rewardsDistribution.rewardsToken', assertEql: ctx.contracts.tokens.TST.address },
    ]
})

.test({
    desc: "should change the rewards token",
    actions: ctx => [
        { send: 'rewardsDistribution.setRewardToken', args: [et.AddressZero], },
        { call: 'rewardsDistribution.rewardsToken', assertEql: et.AddressZero },
    ]
})

.test({
    desc: "should change the authority",
    actions: ctx => [
        { send: 'rewardsDistribution.setAuthority', args: [et.AddressZero], },
        { call: 'rewardsDistribution.authority', assertEql: et.AddressZero },
    ]
})

.test({
    desc: "should revert when non contract owner attempts call onlyOwner functions",
    actions: ctx => [
        { from: ctx.wallet2, send: 'rewardsDistribution.setRewardToken', args: [NON_ZERO_ADDRESS], 
            expectError: 'Only the contract owner may perform this action',
        },
        { from: ctx.wallet2, send: 'rewardsDistribution.setAuthority', args: [NON_ZERO_ADDRESS], 
            expectError: 'Only the contract owner may perform this action',
        },
        { from: ctx.wallet2, send: 'rewardsDistribution.addRewardDistribution', args: [NON_ZERO_ADDRESS, et.eth('1')], 
            expectError: 'Only the contract owner may perform this action',
        },
        { from: ctx.wallet2, send: 'rewardsDistribution.removeRewardDistribution', args: [0], 
            expectError: 'Only the contract owner may perform this action',
        },
        { from: ctx.wallet2, send: 'rewardsDistribution.editRewardDistribution', args: [0, NON_ZERO_ADDRESS, et.eth('1')], 
            expectError: 'Only the contract owner may perform this action',
        },
    ]
})

.test({
    desc: "should have Owned functionality",
    actions: ctx => [
        { from: ctx.wallet2, send: 'rewardsDistribution.nominateNewOwner', args: [ctx.wallet2.address], 
            expectError: 'Only the contract owner may perform this action',
        },
        { from: ctx.wallet, send: 'rewardsDistribution.nominateNewOwner', args: [ctx.wallet2.address], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('OwnerNominated');
                et.expect(logs[0].args.newOwner).to.equal(ctx.wallet2.address);
            }
        },
        { from: ctx.wallet3, send: 'rewardsDistribution.acceptOwnership', 
            expectError: "You must be nominated before you can accept ownership",
        },
        { from: ctx.wallet2, send: 'rewardsDistribution.acceptOwnership',
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('OwnerChanged');
                et.expect(logs[0].args.oldOwner).to.equal(ctx.wallet.address);
                et.expect(logs[0].args.newOwner).to.equal(ctx.wallet2.address);
            }
        },
        { from: ctx.wallet2, send: 'rewardsDistribution.nominateNewOwner', args: [NON_ZERO_ADDRESS], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('OwnerNominated');
                et.expect(logs[0].args.newOwner).to.equal(NON_ZERO_ADDRESS);
            }
        },
    ]
})

.test({
    desc: "should revert when adding a RewardDistribution with zero address",
    actions: ctx => [
        { send: 'rewardsDistribution.addRewardDistribution', args: [et.AddressZero, et.eth('1')], 
            expectError: 'Cant add a zero address',
        },
    ]
})

.test({
    desc: "should revert when adding a RewardDistribution with zero amount",
    actions: ctx => [
        { send: 'rewardsDistribution.addRewardDistribution', args: [NON_ZERO_ADDRESS, et.eth('0')], 
            expectError: 'Cant add a zero amount',
        },
    ]
})


.test({
    desc: "should emit event and store onchain when adding a RewardDistribution",
    actions: ctx => [
        { send: 'rewardsDistribution.addRewardDistribution', args: [NON_ZERO_ADDRESS, et.eth('1')], 
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('RewardDistributionAdded');
                et.expect(logs[0].args.index).to.equal(0);
                et.expect(logs[0].args.destination).to.equal(NON_ZERO_ADDRESS);
                et.expect(logs[0].args.amount).to.equal(et.eth('1'));
            },
        },
        { call: 'rewardsDistribution.distributions', args: [0], assertEql: [NON_ZERO_ADDRESS, et.eth('1')] },
    ]
})

.test({
    desc: "should add multiple reward distributions onchain",
    actions: ctx => [
        { action: 'cb', cb: async () => {
            const inputData = [
                { address: ctx.wallet.address, amount: et.eth('1') },
                { address: ctx.wallet2.address, amount: et.eth('2') },
                { address: ctx.wallet3.address, amount: et.eth('3') },
                { address: ctx.wallet4.address, amount: et.eth('4') },
                { address: ctx.wallet5.address, amount: et.eth('5') },
            ]
            
            for (const [index, data] of inputData.entries()) {
                let result = await (await ctx.contracts.rewardsDistribution.addRewardDistribution(data.address, data.amount)).wait()

                et.expect(result.events.length).to.equal(1);
                et.expect(result.events[0].event).to.equal('RewardDistributionAdded');
                et.expect(result.events[0].args.index).to.equal(index);
                et.expect(result.events[0].args.destination).to.equal(data.address);
                et.expect(result.events[0].args.amount).to.equal(data.amount);

                result = await ctx.contracts.rewardsDistribution.distributions(index)
                et.expect(result[0]).to.equal(data.address);
                et.expect(result[1]).to.equal(data.amount);
            }
        }},
    ]
})

.test({
    desc: "should modify onchain struct when editing a valid RewardDistribution index",
    actions: ctx => [
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet.address, et.eth('1')], },
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet2.address, et.eth('2')], },

        { send: 'rewardsDistribution.editRewardDistribution', args: [0, ctx.wallet3.address, et.eth('3')], },
        { call: 'rewardsDistribution.distributions', args: [0], assertEql: [ctx.wallet3.address, et.eth('3')] },

        { send: 'rewardsDistribution.editRewardDistribution', args: [1, ctx.wallet4.address, et.eth('4')], },
        { call: 'rewardsDistribution.distributions', args: [1], assertEql: [ctx.wallet4.address, et.eth('4')] },
    ]
})

.test({
    desc: "should revert when editing an index too high",
    actions: ctx => [
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet.address, et.eth('1')], },
        { send: 'rewardsDistribution.editRewardDistribution', args: [1, ctx.wallet2.address, et.eth('2')], expectError: "index out of bounds",},
    ]
})

.test({
    desc: "should update distributions array when owner deletes RewardDistribution",
    actions: ctx => [
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet.address, et.eth('1')], },
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet2.address, et.eth('2')], },
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet3.address, et.eth('3')], },

        { call: 'rewardsDistribution.distributionsLength', assertEql: 3 },
        { send: 'rewardsDistribution.removeRewardDistribution', args: [0], },
        { call: 'rewardsDistribution.distributions', args: [0], assertEql: [ctx.wallet2.address, et.eth('2')] },
        { call: 'rewardsDistribution.distributions', args: [1], assertEql: [ctx.wallet3.address, et.eth('3')] },
        
        { call: 'rewardsDistribution.distributionsLength', assertEql: 2 },
        { send: 'rewardsDistribution.removeRewardDistribution', args: [1], },
        { call: 'rewardsDistribution.distributions', args: [0], assertEql: [ctx.wallet2.address, et.eth('2')] },
        
        { call: 'rewardsDistribution.distributionsLength', assertEql: 1 },
    ]
})

.test({
    desc: "should revert when non authority attempts to distributeRewards",
    actions: ctx => [
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet.address, et.eth('1')], },
        { send: 'rewardsDistribution.distributeRewards', args: [1], expectError: "Caller is not authorised"},
    ]
})

.test({
    desc: "should revert when amount to distribute is zero",
    actions: ctx => [
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet.address, et.eth('1')], },
        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [0], expectError: "Nothing to distribute"},
    ]
})

.test({
    desc: "should revert when contract does not have the token balance to distribute",
    actions: ctx => [
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet.address, et.eth('1')], },
        { send: 'tokens.TST.transfer', args: [ctx.contracts.rewardsDistribution.address, et.eth('1').sub(1)], },
        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('1')], expectError: "RewardsDistribution contract does not have enough tokens to distribute"},
    ]
})

.test({
    desc: "should revert when rewards token is not set",
    actions: ctx => [
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet.address, et.eth('1')], },
        { send: 'rewardsDistribution.setRewardToken', args: [et.AddressZero], },
        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [1], expectError: "RewardsToken is not set"},
    ]
})

.test({
    desc: "should send the correct amount of tokens to the listed addresses",
    actions: ctx => [
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet4.address, et.eth('1')], },
        { send: 'rewardsDistribution.addRewardDistribution', args: [ctx.wallet5.address, et.eth('2')], },

        { send: 'tokens.TST.transfer', args: [ctx.contracts.rewardsDistribution.address, et.eth('3')], },
        { call: 'tokens.TST.balanceOf', args: [ctx.contracts.rewardsDistribution.address], assertEql: et.eth('3') },
        
        { from: ctx.wallet2, send: 'rewardsDistribution.distributeRewards', args: [et.eth('3')],
            onLogs: logs => {
                et.expect(logs[0].name).to.equal('RewardsDistributed');
                et.expect(logs[0].args.amount).to.equal(et.eth('3'));
            },
        },
        { call: 'tokens.TST.balanceOf', args: [ctx.wallet4.address], assertEql: et.eth('1') },
        { call: 'tokens.TST.balanceOf', args: [ctx.wallet5.address], assertEql: et.eth('2') },
        { call: 'tokens.TST.balanceOf', args: [ctx.contracts.rewardsDistribution.address], assertEql: et.eth('0') },
    ]
})

.run();
