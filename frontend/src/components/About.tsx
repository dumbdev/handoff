import React from 'react'

const steps = [
  {
    title: 'Client escrows',
    body: 'The client locks the fee up front and sets two deadlines: one to deliver, one to review.',
  },
  {
    title: 'Freelancer delivers',
    body: 'Marking the work delivered starts the review window and closes the door on a refund.',
  },
  {
    title: 'Nobody can stall',
    body: 'Silence past the review window pays the freelancer. Nothing delivered by the deadline refunds the client.',
  },
]

function About() {
  return (
    <div className='w-full my-[50px]'>
      <p className='text-[12px] font-mono text-[#34D399] text-center mb-4'>Freelance escrow on Bitcoin time</p>
      <h1 className='text-[36px] md:text-[48px] font-medium leading-[1.1] font-instrument text-center'>
        Get paid even if <br className='hidden sm:block' />the client ghosts.
      </h1>
      <p className='text-[14px] text-[#908E8E] text-center max-w-[580px] mx-auto mt-5 leading-relaxed'>
        Ordinary escrow still needs the client to click &ldquo;release&rdquo;. When they go quiet, the
        freelancer waits forever. Handoff puts a clock on the review, counted in Bitcoin blocks, so the
        money always lands somewhere.
      </p>
      <ol className='grid md:grid-cols-3 gap-3 mt-10'>
        {steps.map((step, i) => (
          <li key={step.title} className='bg-[#1F1E1F] rounded-[20px] p-5'>
            <p className='text-[12px] font-mono text-[#34D399]'>0{i + 1}</p>
            <p className='text-[18px] font-instrument font-medium mt-1'>{step.title}</p>
            <p className='text-[13px] text-[#908E8E] mt-2 leading-relaxed'>{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default About
