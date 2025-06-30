import { writeFileSync } from 'fs'
import { createPublicClient, getContract, http, webSocket } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const SPAM_CONTRACT_ABI = [
  {
    "type": "function",
    "name": "createAccounts",
    "inputs": [{ "name": "accounts", "type": "address[]" }],
    "outputs": [],
    "stateMutability": "payable"
  }
] as const

async function main() {
  const args = process.argv.slice(2)
  const tpb = parseInt(args[0] || '5') // transactions per block
  const nb = parseInt(args[1] || '2')  // number of blocks

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`
  const spamContract = process.env.SPAM_CONTRACT as `0x${string}`

  if (!privateKey || !spamContract) {
    console.error('Usage: bun run index.ts <tpb> <nb>')
    console.error('tpb = transactions per block, nb = number of blocks')
    console.error('Set PRIVATE_KEY and SPAM_CONTRACT in .env file or environment variable')
    process.exit(1)
  }

  const accountsPerTx = parseInt(args[2] || '100') // accounts per transaction
  const totalAccounts = tpb * nb * accountsPerTx

  console.log(`Generating ${totalAccounts} new target addresses...`)
  const targetAccounts = Array.from({ length: totalAccounts }, () => {
    const newPrivateKey = generatePrivateKey()
    const newAccount = privateKeyToAccount(newPrivateKey)
    return { privateKey: newPrivateKey, address: newAccount.address }
  })

  console.log(`Generated ${targetAccounts.length} new addresses`)
  console.log(`Will send ${tpb} transactions per block for ${nb} blocks (${accountsPerTx} accounts per tx)`)

  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http('https://sepolia.base.org')
  })

  const wsClient = createPublicClient({
    chain: baseSepolia,
    transport: webSocket('wss://sepolia.base.org')
  })

  const spamContractInstance = getContract({
    abi: SPAM_CONTRACT_ABI,
    address: spamContract,
    client: publicClient
  })

  console.log(`\nStarting transaction spam on Base Sepolia...`)
  const allHashes: string[] = [];

  let numBlocksProcessed = 0;
  let nonce = await publicClient.getTransactionCount({ address: account.address })

  const unwatch = wsClient.watchBlockNumber({
    onBlockNumber: async (_bn: bigint) => {
      const tx = await spamContractInstance.write.createAccounts([targetAccounts.map((t) => t.address)], {
        value: BigInt(targetAccounts.length),
        account: account,
        nonce,
      });
      allHashes.push(tx);

      nonce++;
      numBlocksProcessed++;
      if (numBlocksProcessed >= nb) {
        unwatch()
      }
    }
  })

  console.log('\nTransaction spam completed')

  const outputFileName = `output/output-${Date.now()}.json`
  const output = {
    hashes: allHashes,
    targetAccounts,
    tpb,
    nb,
    accountsPerTx,
    totalAccounts
  }

  writeFileSync(outputFileName, JSON.stringify(output, null, 2))
  console.log(`Results saved to ${outputFileName}`)
}

main().catch(console.error)