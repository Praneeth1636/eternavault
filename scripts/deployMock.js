const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\nDeploying MockToken to network: ${network}`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const Token = await hre.ethers.getContractFactory("MockToken");
  const token = await Token.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log(`\nMockToken deployed at: ${address}`);
  console.log("Initial supply: 1,000,000 EVMT minted to deployer.");

  if (network !== "hardhat" && network !== "localhost" && process.env.ETHERSCAN_API_KEY) {
    const tx = token.deploymentTransaction();
    if (tx) await tx.wait(5);
    try {
      await hre.run("verify:verify", { address, constructorArguments: [] });
      console.log("Verified on Etherscan.");
    } catch (err) {
      console.warn(`Verification skipped/failed: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
