import React from 'react'
import Link from 'next/link'
import { handoffContractId } from '@/lib/deployment'
import { scaffoldConfig } from '@/scaffold.config'

function Footer() {
    const contractUrl = handoffContractId
      ? `https://explorer.hiro.so/txid/${handoffContractId}${scaffoldConfig.explorerChainQuery}`
      : null;
    return (
    <div className='w-full mb-[50px] px-4 space-y-2 text-[12px] font-mono text-[#908E8E] text-center'>
        {contractUrl && (
          <p className='break-all'>
            Contract:{' '}
            <a href={contractUrl} target="_blank" rel="noopener noreferrer" className='underline hover:text-[#F4F3EF]'>
              {handoffContractId}
            </a>
          </p>
        )}
        <p>
          Built with{' '}
          <a href="https://scaffoldstacks.mintlify.app/" target="_blank" rel="noopener noreferrer" className='underline hover:text-[#F4F3EF]'>
            Scaffold Stacks
          </a>
          {' · '}
          <Link href="/debug" className='underline hover:text-[#F4F3EF]'>Debug contracts</Link>
          {' · '}
          {scaffoldConfig.network} demo, not audited
        </p>
    </div>

    );
  }

export default Footer
