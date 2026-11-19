<?php

namespace App\Filament\Resources\DriverSubmissions\Pages;

use App\Enums\AuditType;
use App\Enums\SubmissionStatus;
use App\Exceptions\AlreadyDecidedException;
use App\Exceptions\DuplicateDriverException;
use App\Filament\Concerns\CancelsWithLink;
use App\Filament\Resources\DriverSubmissions\DriverSubmissionResource;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use App\Services\Audit\AuditDiff;
use App\Services\Audit\AuditLogger;
use App\Services\DriverSubmissionService;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;

class EditDriverSubmission extends EditRecord
{
    use CancelsWithLink;

    protected static string $resource = DriverSubmissionResource::class;

    protected static ?string $title = 'Revisar envio';

    private function submission(): DriverSubmission
    {
        $record = $this->getRecord();

        if (! $record instanceof DriverSubmission) {
            throw new LogicException('A página de revisão espera um envio de driver.');
        }

        return $record;
    }

    private function pending(): bool
    {
        return $this->submission()->status === SubmissionStatus::Pending;
    }

    private function moderator(): Moderator
    {
        /** @var Moderator $moderator */
        $moderator = Auth::guard('moderator')->user();

        return $moderator;
    }

    // Salvar a revisão grava um evento com o que mudou, na mesma transação.
    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        return DB::transaction(function () use ($record, $data): Model {
            $fields = [...DriverSubmission::DRIVER_FIELDS, ...DriverSubmission::DIMENSION_FIELDS];
            $before = $record->only($fields);

            $record->update($data);

            $changes = AuditDiff::between($before, $record->only($fields), $fields);

            if ($changes !== []) {
                app(AuditLogger::class)->record(AuditType::SubmissionEdited, [
                    'subject_type' => 'submission',
                    'subject_id' => $record->getKey(),
                    'subject_label' => trim("{$record->getAttribute('brand')} {$record->getAttribute('model')} {$record->getAttribute('variant')}"),
                    'changes' => $changes,
                ], $this->moderator());
            }

            return $record;
        });
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('approve')
                ->label('Aprovar')
                ->color('success')
                ->visible(fn (): bool => $this->pending())
                ->requiresConfirmation()
                ->modalHeading('Aprovar e publicar no catálogo?')
                ->modalDescription('O driver passa a aparecer na busca com os valores desta tela.')
                ->action(function (): void {
                    $this->save(shouldRedirect: false, shouldSendSavedNotification: false);

                    try {
                        app(DriverSubmissionService::class)->approve($this->submission(), $this->moderator());
                    } catch (DuplicateDriverException|AlreadyDecidedException $exception) {
                        Notification::make()->danger()->title($exception->getMessage())->send();

                        return;
                    }

                    Notification::make()->success()->title('Driver aprovado e publicado no catálogo.')->send();
                    $this->redirect(DriverSubmissionResource::getUrl('index'));
                }),
            Action::make('reject')
                ->label('Rejeitar')
                ->color('danger')
                ->visible(fn (): bool => $this->pending())
                ->modalHeading('Rejeitar o envio')
                ->schema([
                    Textarea::make('reason')
                        ->label('Motivo')
                        ->helperText('O remetente recebe este texto se informou e-mail.')
                        ->required()
                        ->maxLength(500),
                ])
                ->action(function (array $data): void {
                    try {
                        app(DriverSubmissionService::class)->reject(
                            $this->submission(),
                            $this->moderator(),
                            (string) $data['reason'],
                        );
                    } catch (AlreadyDecidedException|ValidationException $exception) {
                        Notification::make()->danger()->title($exception->getMessage())->send();

                        return;
                    }

                    Notification::make()->success()->title('Envio rejeitado.')->send();
                    $this->redirect(DriverSubmissionResource::getUrl('index'));
                }),
            Action::make('resendNotice')
                ->label('Reenviar aviso')
                ->color('gray')
                ->visible(fn (): bool => ! $this->pending() && $this->submission()->contact_email !== null)
                ->requiresConfirmation()
                ->modalDescription('Envia de novo o aviso da decisão ao e-mail informado no envio.')
                ->action(function (): void {
                    $sent = app(DriverSubmissionService::class)->sendNotice($this->submission());

                    $notification = Notification::make();
                    $sent
                        ? $notification->success()->title('Aviso enviado.')
                        : $notification->danger()->title('Não foi possível enviar o aviso. Tente de novo mais tarde.');
                    $notification->send();

                    $this->refreshFormData(['contact_email']);
                }),
        ];
    }

    // Decididos ficam somente leitura: sem botão de salvar.
    protected function getFormActions(): array
    {
        return $this->pending() ? parent::getFormActions() : [];
    }
}
