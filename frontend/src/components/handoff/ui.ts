// Shared Tailwind class strings, matching the scaffold's dark palette.
export const card = 'bg-[#1F1E1F] rounded-[24px] p-5 md:p-8';
export const inset = 'bg-[#262526] rounded-[16px] p-4';
export const label = 'block text-[12px] font-mono text-[#8F8D8E] mb-2';
export const input =
  'w-full bg-[#131416] border border-[#2E2D2E] rounded-[12px] px-4 py-3 text-[14px] font-mono text-[#F4F3EF] placeholder:text-[#5C5B5C] focus:outline-none focus:border-[#34D399]';
export const primaryButton =
  'bg-[#34D399] hover:bg-[#5BE3B3] text-[#131416] font-instrument font-semibold rounded-[40px] px-6 py-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
export const secondaryButton =
  'bg-[#434242] hover:bg-[#525151] text-[#F4F3EF] font-mono text-[12px] rounded-[40px] px-4 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap';
export const muted = 'text-[#8F8D8E]';

export const toneColor: Record<string, string> = {
  open: 'text-[#60A5FA] border-[#60A5FA]',
  review: 'text-[#34D399] border-[#34D399]',
  done: 'text-[#34D399] border-[#34D399]',
  ended: 'text-[#8F8D8E] border-[#3A3939]',
};
