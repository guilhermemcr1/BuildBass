<?php

namespace App\Exceptions;

use RuntimeException;

/** O driver enviado já está no catálogo ou já aguarda análise (FR-009). */
class DuplicateSubmissionException extends RuntimeException
{
    public const IN_CATALOG = 'already_in_catalog';

    public const PENDING = 'already_pending';

    /**
     * @param  self::IN_CATALOG|self::PENDING  $reason
     */
    public function __construct(public readonly string $reason)
    {
        parent::__construct($reason === self::IN_CATALOG
            ? (string) __('submission.duplicate_in_catalog')
            : (string) __('submission.duplicate_pending'));
    }
}
