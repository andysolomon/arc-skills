# Give retries a budget

Synthetic evaluation fixture; not a published study.

## Mechanism

A client can retry a request after a transient failure. Retrying every failure immediately can add load while a service is already struggling. A delay between attempts gives the service time to recover. Jitter varies that delay so clients do not all retry together.

## Limits

Set a maximum number of attempts and an overall deadline. Stop when either limit is reached. Report the failure when the budget is exhausted. A request that succeeds should exit the loop immediately.

## Side effects

Retrying a payment can duplicate a charge unless the service supports a suitable idempotency mechanism. Retry policies depend on the operation; not every failure is retryable. A retry cannot guarantee success.

## Illustration, not a benchmark

A teaching diagram may show an initial attempt followed by two retries. This is an example, not a recommended universal limit. No latency measurements or success-rate statistics were collected for this article.
