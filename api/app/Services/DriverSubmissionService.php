<?php

namespace App\Services;

use App\Enums\SubmissionStatus;
use App\Exceptions\AlreadyDecidedException;
use App\Exceptions\DuplicateDriverException;
use App\Exceptions\DuplicateSubmissionException;
use App\Http\Requests\StoreDriverSubmissionRequest;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use App\Support\IpHash;
use App\Support\SearchText;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

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
            return DB::transaction(function () use ($submission, $moderator): Driver {
                $locked = $this->lockPending($submission);

                if ($this->existsInCatalog($locked)) {
                    throw new DuplicateDriverException;
                }

                $driver = Driver::create($locked->only(DriverSubmission::DRIVER_FIELDS));

                $locked->forceFill([
                    'status' => SubmissionStatus::Approved,
                    'decided_by' => $moderator->id,
                    'decided_at' => now(),
                    'driver_id' => $driver->id,
                ])->save();

                return $driver;
            });
        } catch (UniqueConstraintViolationException) {
            throw new DuplicateDriverException;
        }
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
        });
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
        return Driver::query()
            ->where('search_text', $submission->dedupe_key)
            ->orWhere(fn ($query) => $query
                ->where('brand', $submission->brand)
                ->where('model', $submission->model)
                ->where('variant', $submission->variant))
            ->exists();
    }
}
