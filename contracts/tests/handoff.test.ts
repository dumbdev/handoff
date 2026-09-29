import { beforeEach, describe, expect, it } from "vitest";
import { Cl, cvToJSON } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const client = accounts.get("wallet_1")!;
const freelancer = accounts.get("wallet_2")!;
const stranger = accounts.get("wallet_3")!;
const contract = `${deployer}.handoff`;

const ERR_NOT_FOUND = Cl.uint(100);
const ERR_NOT_CLIENT = Cl.uint(101);
const ERR_NOT_FREELANCER = Cl.uint(102);
const ERR_WRONG_STATE = Cl.uint(103);
const ERR_INVALID_AMOUNT = Cl.uint(104);
const ERR_INVALID_PERIOD = Cl.uint(105);
const ERR_SELF_HIRE = Cl.uint(106);
const ERR_TOO_EARLY = Cl.uint(107);
const ERR_EMPTY_BRIEF = Cl.uint(109);

const STATUS = {
  funded: 1,
  delivered: 2,
  released: 3,
  claimed: 4,
  refunded: 5,
  declined: 6,
};

const AMOUNT = 10_000_000;
const DELIVER_IN = 20;
const REVIEW = 10;
const BRIEF = "Landing page redesign";

const stx = (who: string) => simnet.getAssetsMap().get("STX")?.get(who) ?? 0n;

const createJob = (
  sender = client,
  to = freelancer,
  amount = AMOUNT,
  deliverIn = DELIVER_IN,
  review = REVIEW,
  brief = BRIEF,
) =>
  simnet.callPublicFn(
    "handoff",
    "create-job",
    [Cl.principal(to), Cl.uint(amount), Cl.uint(deliverIn), Cl.uint(review), Cl.stringUtf8(brief)],
    sender,
  );

const fn = (name: string, jobId: number, sender: string) =>
  simnet.callPublicFn("handoff", name, [Cl.uint(jobId)], sender);

const job = (jobId: number) => simnet.callReadOnlyFn("handoff", "get-job", [Cl.uint(jobId)], client);

/** Read one field out of the (ok {...}) tuple returned by get-job.
 *  cvToJSON renders uints as strings and optionals as { value: { value } }. */
const field = (jobId: number, key: string) => {
  const json = cvToJSON(job(jobId).result) as { value: { value: Record<string, { value: unknown }> } };
  return json.value.value[key]?.value;
};

describe("create-job", () => {
  it("escrows the money and records the job", () => {
    const before = stx(client);
    expect(createJob().result).toBeOk(Cl.uint(1));
    expect(stx(client)).toBe(before - BigInt(AMOUNT));
    expect(stx(contract)).toBe(BigInt(AMOUNT));

    expect(field(1, "client")).toBe(client);
    expect(field(1, "freelancer")).toBe(freelancer);
    expect(field(1, "amount")).toBe("10000000");
    expect(field(1, "brief")).toBe(BRIEF);
    expect(field(1, "status")).toBe(String(STATUS.funded));
    expect(field(1, "deliver-by")).toBe(String(simnet.burnBlockHeight + DELIVER_IN));
  });

  it("hands out increasing job ids and lists them for both parties", () => {
    createJob();
    createJob();
    const forClient = simnet.callReadOnlyFn("handoff", "get-user-jobs", [Cl.principal(client)], client);
    expect(forClient.result).toBeOk(Cl.list([Cl.uint(1), Cl.uint(2)]));
    const forFreelancer = simnet.callReadOnlyFn(
      "handoff",
      "get-user-jobs",
      [Cl.principal(freelancer)],
      client,
    );
    expect(forFreelancer.result).toBeOk(Cl.list([Cl.uint(1), Cl.uint(2)]));
  });

  it("rejects hiring yourself, zero amounts, empty briefs and bad periods", () => {
    expect(createJob(client, client).result).toBeErr(ERR_SELF_HIRE);
    expect(createJob(client, freelancer, 0).result).toBeErr(ERR_INVALID_AMOUNT);
    expect(createJob(client, freelancer, AMOUNT, DELIVER_IN, REVIEW, "").result).toBeErr(ERR_EMPTY_BRIEF);
    expect(createJob(client, freelancer, AMOUNT, 0).result).toBeErr(ERR_INVALID_PERIOD);
    expect(createJob(client, freelancer, AMOUNT, 52_561).result).toBeErr(ERR_INVALID_PERIOD);
    expect(createJob(client, freelancer, AMOUNT, DELIVER_IN, 0).result).toBeErr(ERR_INVALID_PERIOD);
  });

  it("reports nothing for a job id that doesn't exist", () => {
    expect(job(99).result).toBeErr(ERR_NOT_FOUND);
  });
});

describe("release", () => {
  beforeEach(() => {
    createJob();
  });

  it("pays the freelancer straight away when the client is happy", () => {
    const before = stx(freelancer);
    expect(fn("release", 1, client).result).toBeOk(Cl.uint(AMOUNT));
    expect(stx(freelancer)).toBe(before + BigInt(AMOUNT));
    expect(stx(contract)).toBe(0n);
    expect(field(1, "status")).toBe(String(STATUS.released));
  });

  it("works after delivery too", () => {
    fn("mark-delivered", 1, freelancer);
    expect(fn("release", 1, client).result).toBeOk(Cl.uint(AMOUNT));
  });

  it("rejects anyone who is not the client", () => {
    expect(fn("release", 1, freelancer).result).toBeErr(ERR_NOT_CLIENT);
    expect(fn("release", 1, stranger).result).toBeErr(ERR_NOT_CLIENT);
  });

  it("cannot pay twice", () => {
    fn("release", 1, client);
    expect(fn("release", 1, client).result).toBeErr(ERR_WRONG_STATE);
    expect(stx(contract)).toBe(0n);
  });
});

describe("claim after the client goes quiet", () => {
  beforeEach(() => {
    createJob();
    fn("mark-delivered", 1, freelancer);
  });

  it("records the delivery and when payment unlocks", () => {
    const at = simnet.burnBlockHeight;
    expect(field(1, "status")).toBe(String(STATUS.delivered));
    expect(field(1, "claimable-at")).toMatchObject({ value: String(at + REVIEW) });
    expect(field(1, "claimable")).toBe(false);
  });

  it("is blocked while the client still has time to review", () => {
    simnet.mineEmptyBurnBlocks(REVIEW - 1);
    expect(fn("claim", 1, freelancer).result).toBeErr(ERR_TOO_EARLY);
  });

  it("pays the freelancer once the review window closes", () => {
    simnet.mineEmptyBurnBlocks(REVIEW);
    expect(field(1, "claimable")).toBe(true);
    const before = stx(freelancer);
    expect(fn("claim", 1, freelancer).result).toBeOk(Cl.uint(AMOUNT));
    expect(stx(freelancer)).toBe(before + BigInt(AMOUNT));
    expect(field(1, "status")).toBe(String(STATUS.claimed));
  });

  it("rejects anyone who is not the freelancer", () => {
    simnet.mineEmptyBurnBlocks(REVIEW);
    expect(fn("claim", 1, client).result).toBeErr(ERR_NOT_FREELANCER);
    expect(fn("claim", 1, stranger).result).toBeErr(ERR_NOT_FREELANCER);
  });

  it("cannot be claimed twice", () => {
    simnet.mineEmptyBurnBlocks(REVIEW);
    fn("claim", 1, freelancer);
    expect(fn("claim", 1, freelancer).result).toBeErr(ERR_WRONG_STATE);
  });

  it("cannot be claimed on a job that was never delivered", () => {
    createJob();
    simnet.mineEmptyBurnBlocks(REVIEW);
    expect(fn("claim", 2, freelancer).result).toBeErr(ERR_WRONG_STATE);
  });

  it("locks the client out of a refund once work is delivered", () => {
    simnet.mineEmptyBurnBlocks(DELIVER_IN);
    expect(fn("refund", 1, client).result).toBeErr(ERR_WRONG_STATE);
  });
});

describe("refund when nothing is delivered", () => {
  beforeEach(() => {
    createJob();
  });

  it("is blocked before the deadline", () => {
    simnet.mineEmptyBurnBlocks(DELIVER_IN - 1);
    expect(fn("refund", 1, client).result).toBeErr(ERR_TOO_EARLY);
    expect(field(1, "refundable")).toBe(false);
  });

  it("returns the money to the client after the deadline", () => {
    simnet.mineEmptyBurnBlocks(DELIVER_IN);
    expect(field(1, "refundable")).toBe(true);
    const before = stx(client);
    expect(fn("refund", 1, client).result).toBeOk(Cl.uint(AMOUNT));
    expect(stx(client)).toBe(before + BigInt(AMOUNT));
    expect(field(1, "status")).toBe(String(STATUS.refunded));
  });

  it("rejects anyone who is not the client", () => {
    simnet.mineEmptyBurnBlocks(DELIVER_IN);
    expect(fn("refund", 1, freelancer).result).toBeErr(ERR_NOT_CLIENT);
  });

  it("still lets the freelancer deliver right up to the deadline", () => {
    simnet.mineEmptyBurnBlocks(DELIVER_IN - 1);
    expect(fn("mark-delivered", 1, freelancer).result).toBeOk(Cl.uint(simnet.burnBlockHeight));
  });
});

describe("decline", () => {
  beforeEach(() => {
    createJob();
  });

  it("hands the escrow back to the client", () => {
    const before = stx(client);
    expect(fn("decline", 1, freelancer).result).toBeOk(Cl.uint(AMOUNT));
    expect(stx(client)).toBe(before + BigInt(AMOUNT));
    expect(stx(contract)).toBe(0n);
    expect(field(1, "status")).toBe(String(STATUS.declined));
  });

  it("rejects anyone who is not the freelancer", () => {
    expect(fn("decline", 1, client).result).toBeErr(ERR_NOT_FREELANCER);
  });

  it("is not allowed once the work is delivered", () => {
    fn("mark-delivered", 1, freelancer);
    expect(fn("decline", 1, freelancer).result).toBeErr(ERR_WRONG_STATE);
  });
});

describe("mark-delivered", () => {
  it("rejects anyone who is not the freelancer", () => {
    createJob();
    expect(fn("mark-delivered", 1, client).result).toBeErr(ERR_NOT_FREELANCER);
    expect(fn("mark-delivered", 1, stranger).result).toBeErr(ERR_NOT_FREELANCER);
  });

  it("cannot be repeated", () => {
    createJob();
    fn("mark-delivered", 1, freelancer);
    expect(fn("mark-delivered", 1, freelancer).result).toBeErr(ERR_WRONG_STATE);
  });
});

it("keeps each job's escrow separate", () => {
  createJob();
  createJob(stranger, freelancer, 4_000_000);
  expect(stx(contract)).toBe(BigInt(AMOUNT + 4_000_000));
  fn("release", 1, client);
  expect(stx(contract)).toBe(4_000_000n);
  expect(field(2, "status")).toBe(String(STATUS.funded));
});
