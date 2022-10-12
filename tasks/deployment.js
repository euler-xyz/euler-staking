const child_process = require("child_process");

task("deploy:distributor")
    .addPositionalParam("owner")
    .addPositionalParam("authority")
    .addPositionalParam("rewardToken")
    .setAction(async (args) => {
        await run("compile");

        const factory = await ethers.getContractFactory('RewardsDistribution');
        const tx = await factory.deploy(
            args.owner,
            args.authority,
            args.rewardToken,
        );
        
        console.log(`Transaction: ${tx.deployTransaction.hash}`);

        const result = await tx.deployed();
        console.log(`Contract: ${result.address}`);
    })

task("deploy:staking")
    .addPositionalParam("owner")
    .addPositionalParam("distributor")
    .addPositionalParam("rewardToken")
    .addPositionalParam("stakingToken")
    .setAction(async (args) => {
        await run("compile");

        const factory = await ethers.getContractFactory('StakingRewards');
        const tx = await factory.deploy(
            args.owner,
            args.distributor,
            args.rewardToken,
            args.stakingToken,
        );
        
        console.log(`Transaction: ${tx.deployTransaction.hash}`);

        const result = await tx.deployed();
        console.log(`Contract: ${result.address}`);
    })
