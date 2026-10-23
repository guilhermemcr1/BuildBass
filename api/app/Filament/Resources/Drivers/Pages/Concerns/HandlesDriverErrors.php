<?php

namespace App\Filament\Resources\Drivers\Pages\Concerns;

use App\Exceptions\DuplicateDriverException;
use Closure;
use Filament\Notifications\Notification;
use Filament\Support\Exceptions\Halt;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Tradução dos erros do `DriverService` para o formulário: cada falha aparece no campo certo e em
 * um aviso, e uma falha inesperada não derruba a página (vira aviso e vai para o log).
 */
trait HandlesDriverErrors
{
    /**
     * @template T
     *
     * @param  Closure(): T  $operation
     * @return T
     */
    protected function guardDriverOperation(Closure $operation): mixed
    {
        try {
            return $operation();
        } catch (DuplicateDriverException $exception) {
            Notification::make()->danger()->title('Driver já cadastrado')->body($exception->getMessage())->persistent()->send();

            throw ValidationException::withMessages([
                'data.brand' => 'Fabricante, modelo e variante já existem no catálogo.',
                'data.model' => $exception->getMessage(),
            ]);
        } catch (ValidationException $exception) {
            // O service valida com as chaves cruas ("qts"); o formulário guarda tudo em "data.".
            $errors = [];
            foreach ($exception->errors() as $key => $messages) {
                $errors[str_starts_with($key, 'data.') ? $key : "data.{$key}"] = $messages;
            }

            Notification::make()->danger()->title('Confira os campos destacados')->send();

            throw ValidationException::withMessages($errors);
        } catch (Halt $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            report($exception);
            Notification::make()->danger()->title('Não foi possível salvar')
                ->body('Algo deu errado do nosso lado e nada foi alterado. Tente de novo; se repetir, avise quem mantém o sistema.')
                ->persistent()->send();

            throw new Halt;
        }
    }
}
