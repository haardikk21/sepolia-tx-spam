import { createWalletClient, createPublicClient, http, webSocket } from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { writeFileSync } from 'fs'

async function main() {
  const args = process.argv.slice(2)
  const tpb = parseInt(args[0] || '5') // transactions per block
  const nb = parseInt(args[1] || '2')  // number of blocks

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`

  if (!privateKey) {
    console.error('Usage: bun run index.ts <tpb> <nb>')
    console.error('tpb = transactions per block, nb = number of blocks')
    console.error('Set PRIVATE_KEY in .env file or environment variable')
    process.exit(1)
  }

  const amount = 1n // 1 wei
  const totalTxs = tpb * nb

  console.log(`Generating ${totalTxs} new target addresses...`)
  const targetAccounts = Array.from({ length: totalTxs }, () => {
    const newPrivateKey = generatePrivateKey()
    const newAccount = privateKeyToAccount(newPrivateKey)
    return { privateKey: newPrivateKey, address: newAccount.address }
  })

  console.log(`Generated ${targetAccounts.length} new addresses`)
  console.log(`Will send ${tpb} transactions per block for ${nb} blocks`)

  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http('https://sepolia.base.org')
  })

  const wsClient = createPublicClient({
    chain: baseSepolia,
    transport: webSocket('wss://sepolia.base.org')
  })

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http('https://sepolia.base.org')
  })

  console.log(`\nStarting transaction spam on Base Sepolia...`)
  const allHashes: string[] = [];

  let numBlocksProcessed = 0;
  let nonce = await publicClient.getTransactionCount({ address: account.address })

  const unwatch = wsClient.watchBlockNumber({
    onBlockNumber: async (_bn: bigint) => {
      const blockHashPromises = [];
      // Send tpb transactions quickly
      for (const target of targetAccounts) {
        const hashPromise = walletClient.sendTransaction({
          to: target.address,
          value: amount,
          nonce,
        })

        nonce++;
        blockHashPromises.push(hashPromise);
      }

      const blockHashes = await Promise.all(blockHashPromises);
      allHashes.push(...blockHashes)
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
    nb
  }

  writeFileSync(outputFileName, JSON.stringify(output, null, 2))
  console.log(`Results saved to ${outputFileName}`)
}

main().catch(console.error)