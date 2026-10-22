<?php

namespace App\Exceptions\Manual;

/** O visitante passou do limite de análises por hora. */
class ManualRateLimitedException extends ManualException
{
    public function __construct(public readonly int $retryAfterS)
    {
        parent::__construct('rate_limited', 429);
    }
}
