const child_process = require("child_process");
const ABI = [
    "function addRewardDistribution(address, uint) returns (bool)",
    "function distributeRewards() returns (bool)"
]

task("distribution:add")
    .addPositionalParam("distributor")
    .addPositionalParam("destination")
    .addPositionalParam("amount")
    .setAction(async (args) => {
        await run("compile");

        const distributor = new ethers.Contract(args.distributor, ABI, ethers.provider);
        
        const [ signer ] = await ethers.getSigners()
        const tx = await distributor.connect(signer).addRewardDistribution(args.destination, args.amount);
        console.log(`Transaction: ${tx.hash}`);
    })

task("distribution:distribute")
    .addPositionalParam("distributor")
    .setAction(async (args) => {
        await run("compile");

        const distributor = new ethers.Contract(args.distributor, ABI, ethers.provider);
        
        const [ signer ] = await ethers.getSigners()
        const tx = await distributor.connect(signer).distributeRewards();
        console.log(`Transaction: ${tx.hash}`);
    })
