<?php

namespace App\Services;

use App\Enums\AuditType;
use App\Enums\DriverOrigin;
use App\Enums\SubmissionStatus;
use App\Exceptions\AlreadyDecidedException;
use App\Exceptions\DuplicateDriverException;
use App\Exceptions\DuplicateSubmissionException;
use App\Http\Requests\StoreDriverSubmissionRequest;
use App\Mail\SubmissionDecided;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use App\Services\Audit\AuditLogger;
use App\Support\IpHash;
use App\Support\SearchText;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Throwable;

class DriverSubmissionService
{
    /**
     * Grava um envio pendente. Do remetente só ficam o hash do IP e o e-mail opcional. Recusa
     * driver que já está no catálogo ou em análise; um envio rejeitado não bloqueia novo envio.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws DuplicateSubmissionException
     */
    public function create(array $data, string $ip): DriverSubmission
    {
        $submission = new DriverSubmission($data);
        $submission->variant ??= '';
        $submission->dedupe_key = SearchText::normalize(
            "{$submission->brand} {$submission->model} {$submission->variant}",
        );

        if ($this->existsInCatalog($submission)) {
            throw new DuplicateSubmissionException(DuplicateSubmissionException::IN_CATALOG);
        }

        $alreadyPending = DriverSubmission::query()
            ->where('status', SubmissionStatus::Pending)
            ->where('dedupe_key', $submission->dedupe_key)
            ->exists();

        if ($alreadyPending) {
            throw new DuplicateSubmissionException(DuplicateSubmissionException::PENDING);
        }

        $submission->status = SubmissionStatus::Pending;
        $submission->ip_hash = IpHash::make($ip);
        $submission->save();

        return $submission;
    }

    /**
     * Aprova o envio: cria o driver no catálogo com os valores finais, na mesma transação em que
     * marca o envio como aprovado (FR-017). Colisão com um driver existente ou envio já decidido
     * não mudam nada.
     *
     * @throws AlreadyDecidedException
     * @throws DuplicateDriverException
     */
    public function approve(DriverSubmission $submission, Moderator $moderator): Driver
    {
        try {
            $driver = DB::transaction(function () use ($submission, $moderator): Driver {
                $locked = $this->lockPending($submission);

                if ($this->existsInCatalog($locked)) {
                    throw new DuplicateDriverException;
                }

                $driver = Driver::create([
                    ...$locked->only(DriverSubmission::DRIVER_FIELDS),
                    'origin' => DriverOrigin::ApprovedSubmission,
                ]);

                $audit = app(AuditLogger::class);
                $audit->record(AuditType::DriverCreated, [
                    'subject_type' => 'driver',
                    'subject_id' => $driver->id,
                    'subject_label' => $audit->driverLabel($driver),
                    'snapshot' => DriverService::snapshot($driver),
                ], $moderator);

                $locked->forceFill([
                    'status' => SubmissionStatus::Approved,
                    'decided_by' => $moderator->id,
                    'decided_at' => now(),
                    'driver_id' => $driver->id,
                ])->save();

                $audit->record(AuditType::SubmissionApproved, [
                    'outcome' => 'ok',
                    'subject_type' => 'submission',
                    'subject_id' => $locked->id,
                    'subject_label' => $audit->driverLabel($driver),
                    'snapshot' => ['driver_id' => $driver->id],
                ], $moderator);

                return $driver;
            });
        } catch (UniqueConstraintViolationException) {
            throw new DuplicateDriverException;
        }

        $this->sendNotice($submission->refresh());

        return $driver;
    }

    /**
     * Rejeita o envio. O motivo é obrigatório (1 a 500 caracteres de texto puro).
     *
     * @throws AlreadyDecidedException
     * @throws ValidationException
     */
    public function reject(DriverSubmission $submission, Moderator $moderator, string $reason): void
    {
        $reason = StoreDriverSubmissionRequest::plainText($reason);

        if ($reason === '' || mb_strlen($reason) > 500) {
            throw ValidationException::withMessages([
                'rejection_reason' => 'Informe o motivo da rejeição (até 500 caracteres).',
            ]);
        }

        DB::transaction(function () use ($submission, $moderator, $reason): void {
            $locked = $this->lockPending($submission);

            $locked->forceFill([
                'status' => SubmissionStatus::Rejected,
                'decided_by' => $moderator->id,
                'decided_at' => now(),
                'rejection_reason' => $reason,
            ])->save();

            app(AuditLogger::class)->record(AuditType::SubmissionRejected, [
                'outcome' => 'ok',
                'reason' => 'rejected',
                'subject_type' => 'submission',
                'subject_id' => $locked->id,
                'subject_label' => trim("{$locked->brand} {$locked->model} {$locked->variant}"),
                'changes' => ['rejection_reason' => [null, $reason]],
            ], $moderator);
        });

        $this->sendNotice($submission->refresh());
    }

    /**
     * Avisa o remetente da decisão, se ele deixou e-mail, e apaga o e-mail em seguida (FR-019).
     * Roda depois do commit: uma falha no envio é registrada e a decisão continua valendo; o
     * e-mail fica guardado para nova tentativa (sendNotice de novo, pelo painel).
     *
     * @return bool verdadeiro quando o aviso saiu (ou não havia e-mail a avisar)
     */
    public function sendNotice(DriverSubmission $submission): bool
    {
        $email = $submission->contact_email;

        if ($email === null || $submission->status === SubmissionStatus::Pending) {
            return true;
        }

        try {
            Mail::to($email)->send(new SubmissionDecided($submission));
        } catch (Throwable $exception) {
            // A mensagem do mailer pode citar o endereço; o e-mail só vive em contact_email.
            Log::warning('Falha ao enviar o aviso de decisão do envio.', [
                'submission' => $submission->getKey(),
                'exception' => $exception::class,
                'message' => str_replace($email, '[e-mail omitido]', $exception->getMessage()),
            ]);

            return false;
        }

        $submission->forceFill(['contact_email' => null])->save();

        return true;
    }

    /**
     * Avisos para o moderador sobre um envio pendente (FR-015): driver igual no catálogo, outro
     * envio igual em análise e outros envios do mesmo remetente (mesma impressão de rede).
     *
     * @return list<string>
     */
    public function alertsFor(DriverSubmission $submission): array
    {
        if ($submission->status !== SubmissionStatus::Pending) {
            return [];
        }

        $alerts = [];

        if ($this->existsInCatalog($submission)) {
            $alerts[] = 'Possível duplicata do catálogo';
        }

        $sameDriver = DriverSubmission::query()
            ->where('status', SubmissionStatus::Pending)
            ->where('dedupe_key', $submission->dedupe_key)
            ->whereKeyNot($submission->id)
            ->exists();

        if ($sameDriver) {
            $alerts[] = 'Possível duplicata de outro envio';
        }

        $sameSender = DriverSubmission::query()
            ->where('ip_hash', $submission->ip_hash)
            ->whereKeyNot($submission->id)
            ->count();

        if ($sameSender > 0) {
            $alerts[] = ($sameSender + 1).' envios do mesmo remetente';
        }

        return $alerts;
    }

    /**
     * Lê o envio de novo com trava de linha; só envios pendentes seguem.
     */
    private function lockPending(DriverSubmission $submission): DriverSubmission
    {
        $locked = DriverSubmission::query()->lockForUpdate()->findOrFail($submission->id);

        if ($locked->status !== SubmissionStatus::Pending) {
            throw new AlreadyDecidedException;
        }

        return $locked;
    }

    public function existsInCatalog(DriverSubmission $submission): bool
    {
        return app(DriverCatalogService::class)->existsDuplicate(
            $submission->brand,
            $submission->model,
            $submission->variant,
        );
    }
}
