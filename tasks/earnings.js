const child_process = require("child_process");
const fs = require("fs");
const ABI = [
    "function earned(address) public view returns (uint256)",
    "event Staked(address indexed, uint256)",
]

task("earnings:current")
    .setAction(async (args) => {
        const manifest = require(`../addresses/euler-staking-addresses-${network.name}.json`);

        for (const key in manifest) {
            const k = key.match(/(stakingRewards_)(.+)/)
            const symbol = k && k[2];

            if (!symbol) continue;

            const pool = new ethers.Contract(manifest[key], ABI, ethers.provider);

            let addresses = (await pool.queryFilter(pool.filters.Staked()))
                .map(log => log.args[0].toLowerCase());
            
            // remove duplicates
            addresses = [...new Set(addresses)];

            const earnings = await Promise.all(addresses.map(async (address) => pool.earned(address)));

            // give the provider some rest
            console.log(`Waiting for 15 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 15000));

            const code = await Promise.all(addresses.map(async (address) => ethers.provider.getCode(address)));

            const result = addresses.map((address, index) => ({
                address,
                earnings: parseFloat(ethers.utils.formatEther(earnings[index])),
                isContract: code[index] !== "0x",
            })).sort((a, b) => b.earnings - a.earnings);

            fs.writeFileSync(
                `earnings-${symbol}-${network.name}.json`, 
                JSON.stringify(result, null, 2)
            );

            // give the provider some rest
            console.log(`Processed ${symbol} pool earnings. Waiting for 15 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 15000));
        }
    })
