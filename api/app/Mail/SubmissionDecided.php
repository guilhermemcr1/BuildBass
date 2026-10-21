<?php

namespace App\Mail;

use App\Enums\SubmissionStatus;
use App\Models\DriverSubmission;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Aviso ao remetente de que o envio foi aprovado ou rejeitado (com o motivo). Sai no idioma do
 * envio. Os textos do remetente vão escapados pelo componente de e-mail.
 */
class SubmissionDecided extends Mailable
{
    public function __construct(public readonly DriverSubmission $submission)
    {
        $this->locale(self::localeFor($submission));
    }

    public static function localeFor(DriverSubmission $submission): string
    {
        return $submission->locale === 'en' ? 'en' : 'pt_BR';
    }

    private function approved(): bool
    {
        return $this->submission->status === SubmissionStatus::Approved;
    }

    private function key(): string
    {
        return $this->approved() ? 'approved' : 'rejected';
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: (string) __("mail.{$this->key()}.subject"));
    }

    public function content(): Content
    {
        $submission = $this->submission;
        $driver = trim("{$submission->brand} {$submission->model} {$submission->variant}");
        $key = $this->key();

        return new Content(
            markdown: 'mail.submission-decided',
            with: [
                'heading' => (string) __("mail.{$key}.heading"),
                'intro' => (string) __("mail.{$key}.intro", ['driver' => $driver]),
                'reasonLabel' => $this->approved() ? null : (string) __('mail.rejected.reason'),
                'reason' => $submission->rejection_reason,
                'outro' => (string) __("mail.{$key}.outro"),
                'protocol' => (string) __('mail.protocol', ['protocol' => $submission->id]),
            ],
        );
    }
}
