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
  const acpb = parseInt(args[0] || '5') // account creations per block
  const nb = parseInt(args[1] || '2')  // number of blocks

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`
  const spamContract = process.env.SPAM_CONTRACT as `0x${string}`

  if (!privateKey || !spamContract) {
    console.error('Usage: bun run index.ts <acpb> <nb>')
    console.error('acpb = account creations per block, nb = number of blocks')
    console.error('Set PRIVATE_KEY and SPAM_CONTRACT in .env file or environment variable')
    process.exit(1)
  }

  const totalAccounts = acpb * nb
  console.log(`Generating ${totalAccounts} new target addresses...`)
  const allAccounts: { privateKey: `0x${string}`, address: `0x${string}` }[][] = new Array(nb).fill(Array.from({ length: acpb }, () => {
    const newPrivateKey = generatePrivateKey()
    const newAccount = privateKeyToAccount(newPrivateKey)
    return { privateKey: newPrivateKey, address: newAccount.address }
  }))

  console.log(`Generated ${totalAccounts} new addresses`)
  console.log(`Will send ${acpb} account creations per block for ${nb} blocks`)

  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http('https://sepolia.base.org')
  })

  const wsClient = createPublicClient({
    chain: baseSepolia,
    transport: webSocket('wss://base-sepolia-rpc.publicnode.com')
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

  wsClient.watchBlockNumber({
    onError: (error) => {
      console.error('Error watching block number:', error)
      process.exit(1)
    },
    onBlockNumber: async (_bn: bigint) => {
      console.log(`Processing block ${numBlocksProcessed + 1}/${nb}...`)
      try {
        const targetAccounts = allAccounts[numBlocksProcessed]!;
        const chunkedAccounts = chunk(targetAccounts, 500)
        const hashPromises = [];
        for (const chunk of chunkedAccounts) {
          console.log(`Sending transaction for ${chunk.length} accounts with nonce ${nonce}...`)
          const txPromise = spamContractInstance.write.createAccounts([chunk.map((t) => t.address)], {
            value: BigInt(chunk.length),
            account: account,
            nonce,
          });
          hashPromises.push(txPromise);
          nonce++;
        }
        const txs = await Promise.all(hashPromises);
        allHashes.push(...txs);
      } catch (e) {
        console.error('Error sending transaction:', e)
        if (e instanceof Error && e.message.includes('nonce too low')) {
          console.log('Nonce too low, waiting for next block...')
          return
        }
        throw e
      }

      numBlocksProcessed++;
      if (numBlocksProcessed >= nb) {
        console.log('\nTransaction spam completed')

        const outputFileName = `output/output-${Date.now()}.json`
        const output = {
          hashes: allHashes,
          allAccounts,
          acpb,
          nb,
        }

        writeFileSync(outputFileName, JSON.stringify(output, null, 2))
        console.log(`Results saved to ${outputFileName}`)
        process.exit(0)
      }
    }
  })
}

function chunk<T>(array: T[], size: number): T[][] {
  return array.reduce((acc, item, index) => {
    const chunkIndex = Math.floor(index / size)
    if (!acc[chunkIndex]) {
      acc[chunkIndex] = []
    }
    acc[chunkIndex].push(item)
    return acc
  }, [] as T[][])
}

main().catch(console.error)