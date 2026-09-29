;; handoff.clar
;; Escrow for freelance work that can't be ghosted.
;;
;; A client funds a job up front. The freelancer marks it delivered, which
;; starts a review window measured in Bitcoin blocks. The client can release
;; the money at any time. If the client says nothing before the window closes,
;; the freelancer can take the payment themselves. If the freelancer never
;; delivers by the agreed deadline, the client gets a refund.

(define-constant ERR_NOT_FOUND (err u100))
(define-constant ERR_NOT_CLIENT (err u101))
(define-constant ERR_NOT_FREELANCER (err u102))
(define-constant ERR_WRONG_STATE (err u103))
(define-constant ERR_INVALID_AMOUNT (err u104))
(define-constant ERR_INVALID_PERIOD (err u105))
(define-constant ERR_SELF_HIRE (err u106))
(define-constant ERR_TOO_EARLY (err u107))
(define-constant ERR_TOO_MANY_JOBS (err u108))
(define-constant ERR_EMPTY_BRIEF (err u109))

(define-constant STATUS_FUNDED u1)
(define-constant STATUS_DELIVERED u2)
(define-constant STATUS_RELEASED u3)
(define-constant STATUS_CLAIMED u4)
(define-constant STATUS_REFUNDED u5)
(define-constant STATUS_DECLINED u6)

;; ~1 year of Bitcoin blocks at 10 minutes each.
(define-constant MAX_PERIOD u52560)

(define-data-var next-job-id uint u1)

(define-map jobs
  uint
  {
    client: principal,
    freelancer: principal,
    amount: uint,
    brief: (string-utf8 200),
    deliver-by: uint,
    review-window: uint,
    delivered-at: (optional uint),
    status: uint,
  }
)

;; Clarity maps can't be iterated, so each party keeps a list of up to 50 job
;; ids for the frontend to read in one call.
(define-map user-jobs
  principal
  (list 50 uint)
)

(define-private (valid-period (period uint))
  (and (> period u0) (<= period MAX_PERIOD))
)

;; Move STX from the contract's own balance to `recipient`.
(define-private (pay-out
    (amount uint)
    (recipient principal)
  )
  (as-contract? ((with-stx amount))
    (try! (stx-transfer? amount tx-sender recipient))
  )
)

(define-private (index-job
    (who principal)
    (job-id uint)
  )
  (let ((existing (default-to (list) (map-get? user-jobs who))))
    ;; as-max-len? needs a literal length, so MAX_JOBS_PER_USER can't be used here.
    (map-set user-jobs who
      (unwrap! (as-max-len? (append existing job-id) u50) ERR_TOO_MANY_JOBS))
    (ok true)
  )
)

;; Client escrows `amount` for `freelancer`. `deliver-in` and `review-window`
;; are both counted in Bitcoin blocks from now.
(define-public (create-job
    (freelancer principal)
    (amount uint)
    (deliver-in uint)
    (review-window uint)
    (brief (string-utf8 200))
  )
  (let (
      (client tx-sender)
      (job-id (var-get next-job-id))
    )
    (asserts! (not (is-eq freelancer client)) ERR_SELF_HIRE)
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (> (len brief) u0) ERR_EMPTY_BRIEF)
    (asserts! (valid-period deliver-in) ERR_INVALID_PERIOD)
    (asserts! (valid-period review-window) ERR_INVALID_PERIOD)
    (try! (stx-transfer? amount client current-contract))
    (map-set jobs job-id {
      client: client,
      freelancer: freelancer,
      amount: amount,
      brief: brief,
      deliver-by: (+ burn-block-height deliver-in),
      review-window: review-window,
      delivered-at: none,
      status: STATUS_FUNDED,
    })
    (try! (index-job client job-id))
    (try! (index-job freelancer job-id))
    (var-set next-job-id (+ job-id u1))
    (print {
      event: "create-job",
      job-id: job-id,
      client: client,
      freelancer: freelancer,
      amount: amount,
    })
    (ok job-id)
  )
)

;; Freelancer says the work is done. This starts the review window, and from
;; here the client can no longer take a refund.
(define-public (mark-delivered (job-id uint))
  (let ((job (unwrap! (map-get? jobs job-id) ERR_NOT_FOUND)))
    (asserts! (is-eq tx-sender (get freelancer job)) ERR_NOT_FREELANCER)
    (asserts! (is-eq (get status job) STATUS_FUNDED) ERR_WRONG_STATE)
    (map-set jobs job-id
      (merge job {
        status: STATUS_DELIVERED,
        delivered-at: (some burn-block-height),
      })
    )
    (print {
      event: "mark-delivered",
      job-id: job-id,
      at: burn-block-height,
    })
    (ok burn-block-height)
  )
)

;; Client approves and pays. Allowed at any point before the job is settled,
;; so a happy client never has to wait for the deadline.
(define-public (release (job-id uint))
  (let (
      (job (unwrap! (map-get? jobs job-id) ERR_NOT_FOUND))
      (amount (get amount job))
      (status (get status job))
    )
    (asserts! (is-eq tx-sender (get client job)) ERR_NOT_CLIENT)
    (asserts!
      (or (is-eq status STATUS_FUNDED) (is-eq status STATUS_DELIVERED))
      ERR_WRONG_STATE
    )
    (map-set jobs job-id (merge job { status: STATUS_RELEASED }))
    (try! (pay-out amount (get freelancer job)))
    (print {
      event: "release",
      job-id: job-id,
      amount: amount,
    })
    (ok amount)
  )
)

;; The anti-ghosting path: once the review window has passed with no response
;; from the client, the freelancer takes the payment.
(define-public (claim (job-id uint))
  (let (
      (job (unwrap! (map-get? jobs job-id) ERR_NOT_FOUND))
      (amount (get amount job))
      (freelancer (get freelancer job))
      (delivered-at (unwrap! (get delivered-at job) ERR_WRONG_STATE))
    )
    (asserts! (is-eq tx-sender freelancer) ERR_NOT_FREELANCER)
    (asserts! (is-eq (get status job) STATUS_DELIVERED) ERR_WRONG_STATE)
    (asserts!
      (>= burn-block-height (+ delivered-at (get review-window job)))
      ERR_TOO_EARLY
    )
    (map-set jobs job-id (merge job { status: STATUS_CLAIMED }))
    (try! (pay-out amount freelancer))
    (print {
      event: "claim",
      job-id: job-id,
      amount: amount,
    })
    (ok amount)
  )
)

;; Client takes their money back when the deadline passed with nothing delivered.
(define-public (refund (job-id uint))
  (let (
      (job (unwrap! (map-get? jobs job-id) ERR_NOT_FOUND))
      (amount (get amount job))
      (client (get client job))
    )
    (asserts! (is-eq tx-sender client) ERR_NOT_CLIENT)
    (asserts! (is-eq (get status job) STATUS_FUNDED) ERR_WRONG_STATE)
    (asserts! (>= burn-block-height (get deliver-by job)) ERR_TOO_EARLY)
    (map-set jobs job-id (merge job { status: STATUS_REFUNDED }))
    (try! (pay-out amount client))
    (print {
      event: "refund",
      job-id: job-id,
      amount: amount,
    })
    (ok amount)
  )
)

;; Freelancer hands the job back before delivering, returning the escrow.
(define-public (decline (job-id uint))
  (let (
      (job (unwrap! (map-get? jobs job-id) ERR_NOT_FOUND))
      (amount (get amount job))
    )
    (asserts! (is-eq tx-sender (get freelancer job)) ERR_NOT_FREELANCER)
    (asserts! (is-eq (get status job) STATUS_FUNDED) ERR_WRONG_STATE)
    (map-set jobs job-id (merge job { status: STATUS_DECLINED }))
    (try! (pay-out amount (get client job)))
    (print {
      event: "decline",
      job-id: job-id,
      amount: amount,
    })
    (ok amount)
  )
)

(define-read-only (get-job (job-id uint))
  (match (map-get? jobs job-id)
    job (let (
        (status (get status job))
        (claimable-at (match (get delivered-at job)
          at (some (+ at (get review-window job)))
          none
        ))
      )
      (ok {
        client: (get client job),
        freelancer: (get freelancer job),
        amount: (get amount job),
        brief: (get brief job),
        deliver-by: (get deliver-by job),
        review-window: (get review-window job),
        delivered-at: (get delivered-at job),
        status: status,
        claimable-at: claimable-at,
        current-height: burn-block-height,
        ;; Freelancer can take payment now.
        claimable: (and
          (is-eq status STATUS_DELIVERED)
          (>= burn-block-height (default-to u0 claimable-at))
        ),
        ;; Client can take their money back now.
        refundable: (and
          (is-eq status STATUS_FUNDED)
          (>= burn-block-height (get deliver-by job))
        ),
      })
    )
    ERR_NOT_FOUND
  )
)

(define-read-only (get-user-jobs (who principal))
  (ok (default-to (list) (map-get? user-jobs who)))
)

(define-read-only (get-next-job-id)
  (ok (var-get next-job-id))
)
